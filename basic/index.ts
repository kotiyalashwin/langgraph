import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { registry } from "@langchain/langgraph/zod";
import * as z from "zod";
import { add, divide, multiply } from "./tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { messagesStateReducer, MessagesZodMeta, StateGraph } from "@langchain/langgraph";

//raw model
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: "YOUR_API_KEY",
});

//This state stores the messages that are produced and the number of LLM_CALLS
const MessagesState = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    //@ts-ignore
    .register(registry, MessagesZodMeta),
  llmCalls: z.number().optional(),
});

const toolsByName = {
  [add.name]: add,
  [multiply.name]: multiply,
  [divide.name]: divide,
};

const tools = Object.values(toolsByName);
const modelWithTools = model.bindTools(tools);

//MODEL NODE- this is the first or we can say the start node of the graph where the llm_call is made
//takes state as the input and returns a state
async function llmCall(state: z.infer<typeof MessagesState>) {
  return {
    messages: await modelWithTools.invoke([
      new SystemMessage(
        "You are a helpful assistant tasked with performing arithmetic on a set of inputs",
      ),
      ...state.messages,
    ]),
    //increase the number of lllmcall
    llmcCalls: (state.llmCalls ?? 0) + 1,
  };
}

//TOOL NODE- this node decides which tool to call and return the executed tool message
async function toolNode(state: z.infer<typeof MessagesState>) {
  //get the latest llm message
  const lastMessage = state.messages.at(-1);
  //if there is no last message or the last Message is not an Ai message then return
  if (lastMessage === null || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }
  const result: ToolMessage[] = [];
  //for each tool call in the AI message (LLM can call one of more tools)
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name]!
    const toolResult = await tool.invoke(toolCall)
    result.push(toolResult)
  }
  return { messages: result };
}

//CONDITION NODE- this can be anything but primarily this is wether to continue or exit the execution
//it checks if there are more tool_calls in the Ai Message or not
// returns an "ACTION"
async function shouldContinue(state: z.infer<typeof MessagesState>) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage == null || !AIMessage.isInstance(lastMessage))
    return "__end__";

  if (lastMessage.tool_calls?.length) {
    // If the LLM makes a tool call, then perform an action
    return "toolNode";
  }

  // Otherwise, we stop (reply to the user)
  return "__end__";
}

//HERE we compile the entire graph to create a agent

const agent = new StateGraph(MessagesState)
  .addNode("llmCall", llmCall)
  .addNode("toolNode", toolNode)
  .addEdge("__start__", "llmCall")
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", "__end__"])
  .addEdge("toolNode", "llmCall")
  .compile();

const aiResult = await agent.invoke({
    messages: [new HumanMessage("Add 3 and 4.Then Multiply the result with itself")]
})

for (const message of aiResult.messages){
    console.log(`[${message.type}]: ${message.text}`)
}
