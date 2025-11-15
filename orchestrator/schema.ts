import * as z from "zod";
import "@langchain/langgraph/zod"
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

