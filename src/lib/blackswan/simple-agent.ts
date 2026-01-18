import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, Annotation, MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { metaTools } from '../nexus/meta-tools';
import { sheetsTools } from '../nexus/sheets-tools';
import { adsTools } from '../nexus/ads-tools';
import { getUserAiConfig } from '@/lib/ai-config';

// 1. Tool Definitions (All tools available)
const getAllTools = () => {
    const tools = [...adsTools, ...metaTools, ...sheetsTools];
    // Remove duplicates if any
    const uniqueToolsMap = new Map();
    tools.forEach(t => {
        if (!uniqueToolsMap.has(t.name)) {
            uniqueToolsMap.set(t.name, t);
        }
    });
    return Array.from(uniqueToolsMap.values());
};

// 2. Model Creation
async function createModelForUser(userId: number) {
    const config = await getUserAiConfig(userId);

    return new ChatOpenAI({
        modelName: config.model,
        apiKey: config.apiKey,
        configuration: {
            baseURL: config.baseURL,
            defaultHeaders: {
                'HTTP-Referer': 'https://centori.io',
                'X-Title': 'Centori Blackswan'
            }
        }
    });
}

// 3. Simple Agent State
const AgentState = Annotation.Root({
    ...MessagesAnnotation.spec,
});

// 4. Agent Node
const agentNode = async (state: typeof AgentState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");

    const userModel = await createModelForUser(userId);
    const tools = getAllTools();

    // Bind all tools to the model
    const modelWithTools = userModel.bindTools(tools as any);

    const systemPrompt = `You are Blackswan, a versatile AI assistant with direct access to all marketing and data tools.
    
    CAPABILITIES:
    - Google Ads (Performance, Live Data)
    - Meta Ads (Campaigns, Insights)
    - Google Sheets (Read, Write, Create)

    INSTRUCTIONS:
    - Answer user questions directly.
    - If you need data, call the appropriate tools immediately.
    - You do not need to create complex plans. Just execute.
    - Current Date/Time: ${new Date().toLocaleString()}
    `;

    const response = await modelWithTools.invoke([
        new SystemMessage(systemPrompt),
        ...state.messages
    ]);

    return { messages: [response] };
};

// 5. Tools Node
const toolsNode = new ToolNode(getAllTools() as any);

// 6. Router
const shouldContinue = (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    // If the LLM called a tool, go to "tools" node
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
    }

    // Otherwise, stop
    return "end";
};

// 7. Graph Construction
const workflow = new StateGraph(AgentState)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue, {
        tools: "tools",
        end: "__end__"
    })
    .addEdge("tools", "agent");

const checkpointer = new MemorySaver();
export const simpleAgentGraph = workflow.compile({ checkpointer });
