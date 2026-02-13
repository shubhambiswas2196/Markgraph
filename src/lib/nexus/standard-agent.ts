import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { adsTools } from './ads-tools';
import { metaTools } from './meta-tools';
import { sheetsTools } from './sheets-tools';
import { supervisorUtilityTools } from './utility-tools';
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
                'X-Title': 'Centori Standard Chat'
            }
        }
    });
}

// 1. Standard Agent Node (Lean ReAct Loop)
const standardNode = async (state: typeof MessagesAnnotation.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");

    const userModel = await createModelForUser(userId);

    // Context Recovery: Scan history for active spreadsheet
    let activeSpreadsheetId = "None";
    const messages = state.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m instanceof ToolMessage && (m.name === 'create_google_sheet' || m.name === 'export_metrics_to_sheets')) {
            try {
                const content = JSON.parse(m.content as string);
                if (content.spreadsheetId) {
                    activeSpreadsheetId = content.spreadsheetId;
                    break;
                }
            } catch (e) { }
        }
    }

    const prompt = `You are a helpful marketing assistant. 
    Current Date/Time: ${new Date().toLocaleString()}
    Active Spreadsheet ID: ${activeSpreadsheetId}
    
    FAST MODE: Do NOT call tools unless the user explicitly asks for data retrieval or an action (e.g., "fetch", "pull", "report", "export", "show metrics"). If the user asks for advice, explanations, or general help, answer directly without tools.
    Use tools directly to answer the user's request only when explicitly asked for data. 
    Provide a short summary paragraph as the default response format.
    Avoid large tables unless the user explicitly asks for a detailed report or a table.
    If numeric details are necessary, keep them inline or in a very small table.
    
    **REPORTING GUIDELINES**:
    - **REUSE SHEET**: If Active Spreadsheet ID is not "None", YOU MUST use it for any sheet operations.
    - **MANDATORY FORMATTING**: Every time you write data to a sheet, you MUST immediately call format_spreadsheet to:
        1. Set the first row (headers) to **BOLD**, white text on a dark blue background.
        2. Auto-resize all columns.
        3. Call set_spreadsheet_colors with theme="ZEBRA" for readability.
    - ALWAYS provide the clickable link to the created or updated sheet. Format it as: [🚀 View Report](URL)
    - If you create a sheet, call it out clearly so the user can see it.`;

    const allTools = [
        ...adsTools,
        ...metaTools,
        ...sheetsTools,
        ...supervisorUtilityTools
    ];

    const modelWithTools = userModel.bindTools(allTools).withConfig({
        metadata: { agentTag: 'worker' }
    });

    const response = await modelWithTools.invoke([
        new SystemMessage(prompt),
        ...state.messages
    ]);

    // Recreate message to strip non-serializable metadata
    const safeResponse = new AIMessage({
        content: response.content,
        tool_calls: response.tool_calls,
        id: typeof response.id === 'string' ? response.id : undefined
    });

    return { messages: [safeResponse] };
};

// 2. Tool Execution Node
const toolsNode = new ToolNode([
    ...adsTools,
    ...metaTools,
    ...sheetsTools,
    ...supervisorUtilityTools
]);

// 3. Routing Logic
const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
    }
    return "__end__";
};

// Graph Construction
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("executor", standardNode)
    .addNode("tools", toolsNode)
    .addEdge("__start__", "executor")
    .addConditionalEdges("executor", shouldContinue, {
        tools: "tools",
        "__end__": "__end__"
    })
    .addEdge("tools", "executor");

export const standardAgentGraph = workflow.compile();
