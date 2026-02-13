import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, Annotation, BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple, SerializerProtocol } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { metaTools } from '../nexus/meta-tools';
import { sheetsTools } from '../nexus/sheets-tools';
import { adsTools } from '../nexus/ads-tools';
import { utilityTools } from '../nexus/utility-tools';
import { getUserAiConfig } from '@/lib/ai-config';
import fs from 'fs';
import path from 'path';

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

// 2. Persistent Checkpointer (File-based)
class FileSystemCheckpointer extends BaseCheckpointSaver {
    protected storagePath: string;

    constructor() {
        super();
        this.storagePath = path.join(process.cwd(), '.agent_checkpoints');
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    async getTuple(config: any): Promise<CheckpointTuple | undefined> {
        const threadId = config.configurable?.thread_id;
        if (!threadId) return undefined;

        const filePath = path.join(this.storagePath, `${threadId}.json`);
        if (!fs.existsSync(filePath)) return undefined;

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return {
                config,
                checkpoint: data.checkpoint,
                metadata: data.metadata,
                parentConfig: data.parentConfig
            };
        } catch (e) {
            console.error(`[Checkpointer] Error reading ${threadId}:`, e);
            return undefined;
        }
    }

    async put(config: any, checkpoint: Checkpoint, metadata: CheckpointMetadata, new_versions: any): Promise<any> {
        const threadId = config.configurable?.thread_id;
        if (!threadId) return;

        const filePath = path.join(this.storagePath, `${threadId}.json`);
        try {
            fs.writeFileSync(filePath, JSON.stringify({ checkpoint, metadata, parentConfig: config }));
        } catch (e) {
            console.error(`[Checkpointer] Error writing ${threadId}:`, e);
        }
    }

    async list(config: any, limit?: number, before?: any): Promise<CheckpointTuple[]> {
        return [];
    }
}

// Helper for retries
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
    try {
        return await fn();
    } catch (e: any) {
        if (retries <= 0) throw e;
        console.warn(`[Retry] Operation failed, ${retries} attempts left. Error: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
    }
};

// 3. State Definition
const AgentState = Annotation.Root({
    ...MessagesAnnotation.spec,
});

// 3. Agent Node
const agentNode = async (state: typeof AgentState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");

    const aiConfig = await getUserAiConfig(userId);

    // Fallback if invalid
    if (!aiConfig.isValid) {
        console.error(`[AgentNode] Invalid Config for ${userId}`);
    }

    const userModel = new ChatOpenAI({
        modelName: aiConfig.model || "gpt-4o",
        apiKey: aiConfig.apiKey,
        configuration: {
            baseURL: aiConfig.baseURL || "https://api.openai.com/v1",
        }
    });

    const tools = getAllTools();
    const lastUserMessage = [...state.messages].reverse().find(m => m instanceof HumanMessage) as HumanMessage | undefined;
    const userText = lastUserMessage?.content ? lastUserMessage.content.toString() : '';
    const allowTools = shouldAllowTools(userText);
    const modelWithTools = allowTools ? userModel.bindTools(tools as any) : userModel;

    const systemPrompt = `You are Romeo, a Super-Agent with direct access to ALL marketing and data tools.
    
    CAPABILITIES:
    - Google Ads (Performance, Live Data)
    - Meta Ads (Campaigns, Insights)
    - Google Sheets (Read, Write, Create)
    
    STRATEGY:
    - You handle EVERYTHING yourself. No routing.
    - If user asks for "Ads Performance", fetch Google AND Meta data.
    - If user wants a report, fetch data first, then call 'create_sheet' or 'write_to_sheet'.
    - FAILURE HANDLING: If a tool fails, Report it. Do not loop endlessly.
    - AUTONOMY: You are persistent. If a task takes multiple steps, keep going until finished.
    - CHECK-POINTING: Every 3-4 tool calls, finalize your current progress summary in the conversation so the user knows where you are.
    
    RESPONSE FORMAT:
    - Provide answers in short summary paragraphs.
    - Avoid huge tables unless specifically requested.
    
    Current Date/Time (Local): ${new Date().toLocaleString()}
    `;

    console.log(`[RomeoSuperAgent] Invoking model for user ${userId}...`);

    try {
        const response = await withRetry(() => modelWithTools.invoke([
            new SystemMessage(systemPrompt),
            ...state.messages
        ]));
        return { messages: [response] };
    } catch (error: any) {
        console.error(`[RomeoSuperAgent] Fatal Error after retries:`, error);
        throw error;
    }
};

// 4. Tools Node
const toolsNode = new ToolNode(getAllTools() as any);

// 5. Router (Standard Loop)
const shouldContinue = (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
    }
    return "__end__";
};

// 6. Graph Construction
const workflow = new StateGraph(AgentState)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue, {
        tools: "tools",
        __end__: "__end__"
    })
    .addEdge("tools", "agent");

const checkpointer = new FileSystemCheckpointer();
export const multiAgentGraph = workflow.compile({ checkpointer });
