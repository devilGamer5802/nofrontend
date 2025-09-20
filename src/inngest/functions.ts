import { z } from "zod";
import { openai, createAgent, createTool } from "@inngest/agent-kit";
import {Sandbox} from "@e2b/code-interpreter";

import { inngest } from "./client";
import { getSandbox } from "./utils";
import { stderr, stdout } from "process";
import { buffer } from "stream/consumers";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId=await step.run("get-sandbox-id", async()=>{
      const sandbox=await Sandbox.create("nofrontend-nextjs-test-7");
      return sandbox.sandboxId;
    });
    const codeAgent = createAgent({
      name: "codeAgent",
      system: "You are an expert next.js developer.You write readable, maintainable code. You write simple Next.js & React snippets.",
      model: openai({ model: "gpt-4o"}),
      tools:[
        createTool({
          name:"terminal",
          description:"Use the terminal to run commands",
          parameters:z.object({
            command: z.string(),
          }),
          handler: async({command},{step})=>{
            return await step?.run("teminal",async()=>{
              const buffers={stdout:"",stderr:""};

              try{
                const sandbox=await getSandbox(sandboxId);
                const result=await sandbox.commands.run(command,{
                  onStdout:(data: string)=>{
                    buffers.stdout+=data;
                  },
                  onStderr:(data: string)=>{
                    buffers.stderr+=data;
                  }
                });
                return result.stdout;
              }catch(e){
                console.error(
                  `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${stderr}`,
                );
                return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${stderr}`;
              }
            });
          }
        })
      ]
    });

    const { output } = await codeAgent.run(
      `Write the following snippet: ${ event.data.value}`,
    );

    const sandboxUrl= await step.run("get-sandbox-url",async()=>{
      const sandbox= await getSandbox(sandboxId);
      const host= sandbox.getHost(3000);
      return `https://${host}`;
    })


    return { output,sandboxUrl };
  },
);