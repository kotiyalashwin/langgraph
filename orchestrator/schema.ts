import * as z from "zod";
import "@langchain/langgraph/zod"
import { registry } from "@langchain/langgraph/zod";
import { register } from "module";
export const changeSchema = z.object({
  filePath: z.string(),
  content: z.string(),
});

export const changesSchema = z.object({
  changes: z.array(changeSchema),
});

export const verifiedSchema = z.object({
  filepath: z.string(),
  correct: z.boolean(),
  solution: z.object({
    line: z.number(),
    content: z.string(),
  }).optional(),
});

export const GraphState = z.object({
  prompt: z.string(),
  changes: changesSchema,
  verified: z.array(verifiedSchema).register(registry,{
        reducer : {
            fn : (x,y)=> x.concat(y)
        },
        default : ()=> [] as z.infer<typeof verifiedSchema>[]
    }),
  created : z.array(z.string()).register(registry,{
        reducer :{
            fn : (x,y)=> x.concat(y)
        },
        default : ()=> []as string[]
    })  
});

export const WorkerState = z.object({
  change: changeSchema,
});


