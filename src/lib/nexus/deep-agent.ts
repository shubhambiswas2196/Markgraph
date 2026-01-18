import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, Annotation, MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { metaTools } from './meta-tools';
import { sheetsTools } from './sheets-tools';
import { adsTools } from './ads-tools';
import { supervisorUtilityTools } from './utility-tools';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { handleLargeResultEviction } from './harness-middleware';
import { getUserAiConfig } from '@/lib/ai-config';

// Create ChatOpenAI instance with user-specific configuration
async function createModelForUser(userId: number) {
    const config = await getUserAiConfig(userId);

    return new ChatOpenAI({
        modelName: config.model,
        apiKey: config.apiKey,
        configuration: {
            baseURL: config.baseURL,
            defaultHeaders: {
                'HTTP-Referer': 'https://centori.io',
                'X-Title': 'Centori Nexus'
            }
        }
    });
}

// Deep Agent State
const DeepState = Annotation.Root({
    ...MessagesAnnotation.spec,
    plan: Annotation<string[]>({ reducer: (a, b) => b ?? a, default: () => [] }),
    currentStep: Annotation<String>({ reducer: (a, b) => b ?? a, default: () => "PLAN" }),
    todo_list: Annotation<string[]>({ reducer: (a, b) => b ?? a, default: () => [] }),
    subagent_reports: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
    finalReport: Annotation<string>({ reducer: (a, b) => b ?? a, default: () => "" }),
    pendingPermission: Annotation<boolean>({ reducer: (a, b) => b ?? a, default: () => false }),
    permissionGranted: Annotation<boolean>({ reducer: (a, b) => b ?? a, default: () => false }),
    // Stateful memory: Cache tool results to avoid redundant fetching
    cachedToolResults: Annotation<Record<string, { data: any, timestamp: number }>>({
        reducer: (a, b) => ({ ...a, ...b }),
        default: () => ({})
    }),
    // Hard limit: Only allow sheet tools if explicitly requested
    sheetRequested: Annotation<boolean>({ reducer: (a, b) => b ?? a, default: () => false }),
    spreadsheetId: Annotation<string>({ reducer: (a, b) => b ?? a, default: () => "" }),
});

// 1. Planner Node
const plannerNode = async (state: typeof DeepState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");

    // Create model for this specific user
    const userModel = await createModelForUser(userId);

    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    // Try to recover spreadsheetId from history if not in state
    let recoveredId = state.spreadsheetId;
    if (!recoveredId) {
        // Look back through history for the most recent create_google_sheet tool result
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m instanceof ToolMessage && m.name === 'create_google_sheet') {
                try {
                    const content = JSON.parse(m.content as string);
                    if (content.spreadsheetId) {
                        recoveredId = content.spreadsheetId;
                        console.log(`[Planner] Recovered Spreadsheet ID from history: ${recoveredId}`);
                        break;
                    }
                } catch (e) { }
            }
        }
    }

    const prompt = `You are a Senior Data Strategist.
  Current Date/Time: ${new Date().toLocaleString()}
  Reflected request: "${lastMessage.content}"
  Active Spreadsheet ID: ${recoveredId || "None"}
  
  Create a step-by-step execution plan.
  
  RULES:
  1. **REUSE SHEET**: If Active Spreadsheet ID is provided, use it for any sheet operations (editing/redesigning). Do NOT create a new one unless specifically asked for a NEW sheet.
  2. **STRICT CREATION**: Do NOT plan to create a sheet unless requested (or if "redesigning" an existing one).
  3. If no sheet is involved, focus on Text Summary.

  Return the plan as a numbered list.`;

    const response = await userModel.invoke(
        [new SystemMessage(prompt)],
        { metadata: { agentTag: 'planner' } }
    );

    const initialTodos = (response.content as string)
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => `[pending] ${line.replace(/^\d+\.\s*/, '')}`);

    // Detect if user asked for a sheet (look back through history for last human message)
    const lastHumanMsg = [...messages].reverse().find(m => m instanceof HumanMessage);
    const userContent = (lastHumanMsg?.content as string || "").toLowerCase();
    const sheetKeywords = ["sheet", "spreadsheet", "google sheet", "excel", "report", "tab"];

    // Tools are enabled if keywords are found OR if we have an active sheet to work on
    const isSheetRequested = sheetKeywords.some(kw => userContent.includes(kw)) || !!recoveredId;

    return {
        plan: [response.content as string],
        todo_list: initialTodos,
        currentStep: "ANALYZE",
        sheetRequested: isSheetRequested,
        spreadsheetId: recoveredId || state.spreadsheetId
    };
};

// 2. Harness Tools
const write_todos = tool(async ({ todos }) => {
    return "Checklist updated.";
}, {
    name: "write_todos",
    description: "Update the agent's internal progress checklist. Use this to mark tasks as [pending], [in_progress], or [completed].",
    schema: z.object({
        todos: z.array(z.string()).describe("The full updated list of todo items with statuses.")
    })
});

const task = tool(async ({ objective }) => {
    return `Sub-task Objective: ${objective}. (Delegated to specialized sub-agent)`;
}, {
    name: "task",
    description: "Delegate a specific sub-task to a specialized sub-agent. Useful for isolated research or code analysis.",
    schema: z.object({
        objective: z.string().describe("The specific goal for the sub-agent.")
    })
});

const read_evicted_result = tool(async ({ tool_call_id }) => {
    return "Full result retrieved from ephemeral memory.";
}, {
    name: "read_evicted_result",
    description: "Read the full contents of a tool result that was evicted due to size.",
    schema: z.object({
        tool_call_id: z.string().describe("The ID of the tool call to retrieve.")
    })
});

// Analyst Node: Combined tools from ALL agents
const write_todos_tool = write_todos; // rename to avoid conflict
const task_tool = task;
const read_evicted_tool = read_evicted_result;

const getAnalystTools = (sheetRequested: boolean) => {
    const tools = [...adsTools, ...metaTools, write_todos_tool, task_tool, read_evicted_tool];
    if (sheetRequested) {
        tools.push(...sheetsTools);
    }

    const uniqueToolsMap = new Map();
    tools.forEach(t => {
        if (!uniqueToolsMap.has(t.name)) {
            uniqueToolsMap.set(t.name, t);
        }
    });
    return Array.from(uniqueToolsMap.values());
};

const analystNode = async (state: typeof DeepState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");

    // Create model for this specific user
    const userModel = await createModelForUser(userId);

    const messages = state.messages.map(m => {
        if (m instanceof ToolMessage && m.additional_kwargs?.isEvicted) {
            return new ToolMessage({
                ...m,
                content: (m.content as string).split('[NOTICE')[0] + "[Evicted Data Reference]"
            } as any);
        }
        return m;
    });

    const plan = state.plan[0];
    const prompt = `You are the Lead Analyst executing this Deep Agent Harness Plan.
    Current Date/Time: ${new Date().toLocaleString()}
    
    CURRENT PLAN:
    ${plan}
    Active Spreadsheet ID: ${state.spreadsheetId || "None"}

    YOUR PROGRESS CHECKLIST (To-Do List):
    ${state.todo_list.join('\n')}

    MISSION:
    Execute the plan using tools. 
    - If you need to edit or add data, use the Active Spreadsheet ID (${state.spreadsheetId || "None"}).
    - Only call create_google_sheet if no ID exists or if a NEW sheet is explicitly requested.
    - Always present your analysis and data tables in the chat response.

    If you MUST create a Google Sheet (and none exists or a new one is requested), you MUST first include the string [SYSTEM_ACTION:REQUEST_SHEET_PERMISSION] and wait.
    `;

    const analystTools = getAnalystTools(state.sheetRequested);
    const modelWithTools = userModel.bindTools(analystTools as any).withConfig({
        metadata: { agentTag: 'worker' }
    });
    const response = await modelWithTools.invoke([new SystemMessage(prompt), ...messages]);

    return { messages: [response] };
};

// 3. Middlewares with Caching
const toolsNodeWithMiddleware = async (state: typeof DeepState.State) => {
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    // Get the last AI message to see what tools were called
    const lastAIMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastAIMessage.tool_calls || [];

    // Check cache for each tool call
    const cachedResults: any[] = [];
    const toolCallsToExecute: any[] = [];

    for (const toolCall of toolCalls) {
        const cacheKey = `${toolCall.name}_${JSON.stringify(toolCall.args)}`;
        const cached = state.cachedToolResults[cacheKey];

        // Check if cache exists and is still valid
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
            console.log(`[Cache HIT] Using cached result for ${toolCall.name}`);
            cachedResults.push(new ToolMessage({
                content: cached.data,
                tool_call_id: toolCall.id!,
                name: toolCall.name
            }));
        } else {
            console.log(`[Cache MISS] Executing ${toolCall.name}`);
            toolCallsToExecute.push(toolCall);
        }
    }

    // Execute only non-cached tools
    let newToolResults: any[] = [];
    const newCacheEntries: Record<string, { data: any, timestamp: number }> = {};
    let extractedSpreadsheetId = "";

    if (toolCallsToExecute.length > 0) {
        // Use the same filtered tools as analystNode
        const analystTools = getAnalystTools(state.sheetRequested);
        const toolsNode = new ToolNode(analystTools as any);

        // Temporarily modify the AI message to only include non-cached tool calls
        const modifiedAIMessage = new AIMessage({
            ...lastAIMessage,
            tool_calls: toolCallsToExecute
        });

        const modifiedState = {
            ...state,
            messages: [...state.messages.slice(0, -1), modifiedAIMessage]
        };

        const result = await toolsNode.invoke(modifiedState);
        newToolResults = result.messages.map(m => {
            if (m instanceof ToolMessage) {
                // Extract spreadsheetId if a new one was created
                if (m.name === 'create_google_sheet') {
                    try {
                        const content = JSON.parse(m.content as string);
                        if (content.spreadsheetId) extractedSpreadsheetId = content.spreadsheetId;
                    } catch (e) { }
                }

                // Cache this result
                const toolCall = toolCallsToExecute.find(tc => tc.id === m.tool_call_id);
                if (toolCall) {
                    const cacheKey = `${toolCall.name}_${JSON.stringify(toolCall.args)}`;
                    newCacheEntries[cacheKey] = {
                        data: m.content,
                        timestamp: now
                    };
                }
                return handleLargeResultEviction(m);
            }
            return m;
        });
    }

    // Combine cached and new results
    const allResults = [...cachedResults, ...newToolResults];

    return {
        messages: allResults,
        cachedToolResults: newCacheEntries,
        spreadsheetId: extractedSpreadsheetId || state.spreadsheetId,
        sheetRequested: state.sheetRequested // Persist the request flag
    };
};

// 4. Router
const shouldContinue = (state: typeof DeepState.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const messageContent = typeof lastMessage.content === 'string' ? lastMessage.content : '';
    const requestsPermission = messageContent.includes('[SYSTEM_ACTION:REQUEST_SHEET_PERMISSION]');

    if (requestsPermission && !state.permissionGranted) {
        lastMessage.tool_calls = [];
        return "end";
    }

    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
    }

    return "end";
};

// Graph Construction
const workflow = new StateGraph(DeepState)
    .addNode("planner", plannerNode)
    .addNode("analyst", analystNode)
    .addNode("tools", toolsNodeWithMiddleware)
    .addEdge("__start__", "planner")
    .addEdge("planner", "analyst")
    .addConditionalEdges("analyst", shouldContinue, {
        tools: "tools",
        end: "__end__"
    })
    .addEdge("tools", "analyst");

const deepCheckpointer = new MemorySaver();
export const deepReasoningGraph = workflow.compile({ checkpointer: deepCheckpointer });
