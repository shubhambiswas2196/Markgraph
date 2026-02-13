import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, Annotation, MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { metaTools } from '../nexus/meta-tools';
import { sheetsTools } from '../nexus/sheets-tools';
import { adsTools } from '../nexus/ads-tools';
import { utilityTools } from '../nexus/utility-tools';
import { getUserAiConfig } from '@/lib/ai-config';

// 1. Tool Definitions (All tools available)
const getAllTools = () => {
    const tools = [...adsTools, ...metaTools, ...sheetsTools, ...utilityTools];
    // Remove duplicates if any
    const uniqueToolsMap = new Map();
    tools.forEach(t => {
        if (!uniqueToolsMap.has(t.name)) {
            uniqueToolsMap.set(t.name, t);
        }
    });
    return Array.from(uniqueToolsMap.values());
};

const shouldAllowTools = (text: string) => {
    const lowered = text.toLowerCase();
    const triggers = [
        'fetch', 'pull', 'report', 'export', 'show', 'metrics', 'performance', 'data',
        'cpa', 'roas', 'ctr', 'impressions', 'clicks', 'conversions', 'spend', 'cost',
        'leads', 'campaign', 'ad group', 'audience', 'location', 'device', 'schedule',
        'time of day', 'placement'
    ];
    return triggers.some(trigger => lowered.includes(trigger));
};
// 2. Model Creation
async function createModelForUser(userId: number) {
    const config = await getUserAiConfig(userId);

    if (!config.isValid) {
        throw new Error(config.errorMessage || "AI Configuration is invalid.");
    }

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

    const aiConfig = await getUserAiConfig(userId);

    if (!aiConfig.isValid) {
        console.error(`[AgentNode] AI Config is invalid for user ${userId}:`, aiConfig.errorMessage);
        throw new Error(aiConfig.errorMessage || "AI Configuration is invalid.");
    }

    console.log(`[AgentNode] AI Config loaded: model=${aiConfig.model}, baseURL=${aiConfig.baseURL}, apiKey=${aiConfig.apiKey?.substring(0, 10)}...`);

    const userModel = new ChatOpenAI({
        modelName: aiConfig.model,
        apiKey: aiConfig.apiKey,
        configuration: {
            baseURL: aiConfig.baseURL,
            defaultHeaders: {
                'HTTP-Referer': 'https://centori.io',
                'X-Title': 'Centori Blackswan'
            }
        }
    });
    const tools = getAllTools();
    const lastUserMessage = [...state.messages].reverse().find(m => m instanceof HumanMessage) as HumanMessage | undefined;
    const userText = lastUserMessage?.content ? lastUserMessage.content.toString() : '';
    const allowTools = shouldAllowTools(userText);

    // Bind tools only when explicitly requested
    const modelWithTools = allowTools ? userModel.bindTools(tools as any) : userModel;

    const systemPrompt = `You are Blackswan, a versatile AI assistant with direct access to all marketing and data tools.
    
    CAPABILITIES:
    - Google Ads (Performance, Live Data)
    - Meta Ads (Campaigns, Insights)
    - Google Sheets (Read, Write, Create)

    INSTRUCTIONS:
    - Answer user questions directly.
    - FAST MODE: Do NOT call tools unless the user explicitly asks for data retrieval or an action (e.g., "fetch", "pull", "report", "export", "show metrics"). If the user asks for advice, explanations, or general help, answer directly without tools.
    - If you need data, call the appropriate tools only when explicitly requested.
    - Provide a short summary paragraph as the default response format.
    - Avoid large tables unless the user explicitly asks for a detailed report or a table.
    - If numeric details are necessary, keep them inline or in a very small table.
    - You do not need to create complex plans. Just execute.
    - Current Date/Time (Local): ${new Date().toLocaleString()}
    - Current Date/Time (ISO): ${new Date().toISOString()}
    - IMPORTANT: If a tool fails or returns the same result twice, STOP and report the error. DO NOT LOOP.
    `;

    console.log(`[AgentNode] Invoking model for user ${userId}...`);

    try {
        const response = await modelWithTools.invoke([
            new SystemMessage(systemPrompt),
            ...state.messages
        ]);
        console.log(`[AgentNode] Model response received. Tool calls: ${response.tool_calls?.length || 0}`);
        console.log(`[AgentNode] Response content length: ${response.content?.toString().length || 0}`);

        return { messages: [response] };
    } catch (error: any) {
        console.error(`[AgentNode] ERROR during model invocation:`, error);
        console.error(`[AgentNode] Error details:`, {
            message: error.message,
            status: error.status,
            code: error.code,
            response: error.response?.data
        });
        throw error;
    }
};

// 5. Tools Node
const toolsNode = new ToolNode(getAllTools() as any);

// 6. Router
const shouldContinue = (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    // If the LLM called a tool, go to "tools" node
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        // Anti-Loop Protection: Check if this tool call is identical to the last one
        // (Look back 2 messages: [..., CACHED_TOOL_RESULT, AI_MESSAGE])
        const prevAiMsgIndex = state.messages.length - 3;
        if (prevAiMsgIndex >= 0) {
            const prevAiMsg = state.messages[prevAiMsgIndex] as AIMessage;
            if (prevAiMsg.tool_calls && prevAiMsg.tool_calls.length > 0) {
                const currentCall = lastMessage.tool_calls[0];
                const prevCall = prevAiMsg.tool_calls[0];

                // If it's the exact same tool and args, assuming it failed or stuck
                if (currentCall.name === prevCall.name && JSON.stringify(currentCall.args) === JSON.stringify(prevCall.args)) {
                    console.log(`[Anti-Loop] Detected repetitive tool call (${currentCall.name}). Stopping.`);
                    return "end";
                }
            }
        }
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
