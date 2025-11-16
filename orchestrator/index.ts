import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as z from "zod";
import {
  changesSchema,
  GraphState,
  verifiedSchema,
  WorkerState,
} from "./schema";
import { Send, StateGraph } from "@langchain/langgraph";
import { promises as fs } from "fs";
import path, { parse } from "path";
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
});

const planner = llm.withStructuredOutput(changesSchema);
const verifier = llm.withStructuredOutput(verifiedSchema);
//Planner
async function plannerNode(state: z.infer<typeof GraphState>) {
  const plans = await planner.invoke([
    {
      role: "system",
      content:
        "You are an AI based website builder which already has a precooked vite react app, Based on users requirement you have to create the user application",
    },
    { role: "human", content: state.prompt },
  ]);
  // console.log(plans.changes);
  return { changes: plans };
}

//Assigning checking of code to worker
async function assignerNode(state: z.infer<typeof GraphState>) {
  return state.changes.changes.map(
    (change) => new Send("verifier", { change }),
  );
}
//assign file writes
async function writeAssignerNode(state: z.infer<typeof GraphState>) {
  return state.changes.changes.map((change) => new Send("writer", { change }));
}
async function allVerifiedNode(state: z.infer<typeof GraphState>) {
  if (state.verified.length === state.changes.changes.length)
    return "__verified__";
  else return "__not_verified__";
}

async function writerNode(state: z.infer<typeof WorkerState>) {
  const { filePath, content } = state.change;
  const fullPath = path.join("app", filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}
async function verifierNode(state: z.infer<typeof WorkerState>) {
  const result = await verifier.invoke([
    {
      role: "system",
      content:
        "You are a professional code analyzer who can find out any possible bug in the code and give its possible solution also.",
    },
    {
      role: "human",
      content: `Verify this code block: ${state.change.content}`,
    },
  ]);

  return new Send("writer", { change: state.change });
}

const agent = new StateGraph(GraphState)
  .addNode("planner", plannerNode)
  .addNode("writer", writerNode)
  .addNode("verifier", verifierNode, { ends: ["writer"] })
  .addEdge("__start__", "planner")
  .addConditionalEdges("planner", assignerNode, ["verifier"])
  .compile();

const result = await agent.invoke({ prompt: "Create a todo app" });
console.log(result.verified);
console.log(result.changes);
