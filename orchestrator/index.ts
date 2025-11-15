import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as z from "zod";
import { changeSchema, changesSchema, verifiedSchema } from "./schema";
import {registry} from  "@langchain/langgraph/zod"
import { Send, StateGraph } from "@langchain/langgraph";
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: "",
});

const GraphState = z.object({
  prompt: z.string(),
  changes: changesSchema,
  verified: z.array(verifiedSchema).register(registry,{
        reducer : {
            fn : (x,y)=> x.concat(y)
        },
        default : ()=> [] as z.infer<typeof verifiedSchema>[]
    })
});

const WorkerState = z.object({
  change: changeSchema,
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
  return state.changes.changes.map((change) => new Send("verifier", { change }));
}

async function verifierNode(state: z.infer<typeof WorkerState>) {
  const result = await verifier.invoke([
    {
      role: "system",
      content:
        "You are a professional code analyzer who can find out any possible bug in the code and give its possible solution also.",
    },
    { role: "human", content: `Verify this code block: ${state.change.content}` },
  ]);
    
    return {verified : result}
}

//Connect e2b with this
//write the function for correcting the code, before writing into the sandbox

const agent = new StateGraph(GraphState)
  .addNode("planner", plannerNode)
  .addEdge("__start__", "planner")
  .addNode("verifier", verifierNode)
  .addConditionalEdges("planner", assignerNode, ["verifier"])
  .compile();

const result = await agent.invoke({ prompt: "Create a todo app" });
console.log(result.verified);
console.log(result.changes);

