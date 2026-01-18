import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { adsTools } from '@/lib/nexus/ads-tools';
import { metaTools } from '@/lib/nexus/meta-tools';
import { sheetsTools } from '@/lib/nexus/sheets-tools';
import { supervisorUtilityTools } from '@/lib/nexus/utility-tools';
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
                'X-Title': 'Centori Multi-Agent'
            }
        }
    });
}

// Simplified Multi-Agent State
const MultiAgentState = Annotation.Root({
    ...MessagesAnnotation.spec,
    currentAgent: Annotation<string>({ reducer: (a, b) => b ?? a, default: () => "alex" }),
    agentHistory: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
    finalResponse: Annotation<string>({ reducer: (a, b) => b ?? a, default: () => "" }),
});

// Define the Routing Tool
const routeTool = tool(
    async () => "Routing...",
    {
        name: "route",
        description: "Select the next agent to handle the user's request. Use this tool when you need to hand off work to a specialist.",
        schema: z.object({
            next: z.enum(["GOOGLE_ADS_AGENT", "META_ADS_AGENT", "SHEETS_AGENT", "FINISH"]),
            reasoning: z.string().describe("Why you are routing to this agent")
        })
    }
);

// 1. Alex (Supervisor Agent) Node
const alexNode = async (state: typeof MultiAgentState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");

    // Create model for this specific user
    const userModel = await createModelForUser(userId);

    const messages = state.messages;
    const completedAgents = state.agentHistory.filter(a => a !== 'alex');

    const prompt = `You are Alex, a helpful marketing assistant.
CONTEXT:
- Agents already run: ${completedAgents.join(', ')}
- Goal: Answer the user's request. If multiple agents are needed (e.g. Google AND Meta), run them sequentially.

ROUTING INSTRUCTIONS:
Use the 'route' tool to select the next step:
- GOOGLE_ADS_AGENT: For Google Ads queries (if not run yet).
- META_ADS_AGENT: For Meta/Facebook Ads queries (if not run yet).
- SHEETS_AGENT: For spreadsheet tasks (if not run yet).
- FINISH: If all data is gathered or no specialist is needed.

If the user asks for Time or Timezone, use the utility tools (get_current_time) directly, DO NOT route.`;

    // Bind route tool AND utility tools
    const modelWithTools = userModel.bindTools([...supervisorUtilityTools, routeTool]);

    const response = await modelWithTools.invoke([
        new SystemMessage(prompt),
        ...messages
    ], { metadata: { agentTag: 'alex' } });

    // Handle Route Tool Call
    const routeCall = response.tool_calls?.find(tc => tc.name === 'route');
    if (routeCall) {
        const destination = routeCall.args.next;
        const agentMap: Record<string, string> = {
            "GOOGLE_ADS_AGENT": "google_ads_agent",
            "META_ADS_AGENT": "meta_ads_agent",
            "SHEETS_AGENT": "sheets_agent",
            "FINISH": "alex"
        };
        const nextAgent = agentMap[destination] || "alex";

        return {
            messages: [response],
            currentAgent: nextAgent,
            agentHistory: [nextAgent]
        };
    }

    // Handle Utility Tool Calls
    if (response.tool_calls && response.tool_calls.length > 0) {
        return {
            messages: [response],
            currentAgent: "alex"
        };
    }

    // Fallback implies FINISH
    return {
        messages: [response],
        currentAgent: "alex",
        finalResponse: response.content as string
    };
};

// 2. Google Ads Agent Node
const googleAdsAgent = async (state: typeof MultiAgentState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");
    const userModel = await createModelForUser(userId);

    const messages = state.messages;

    const systemPrompt = `You are the Google Ads Agent, an expert in Google Ads advertising and marketing analytics.

CRITICAL PROTOCOL: 
1. PRE-CHECK: Before performing ANY data query, you MUST usage the [get_account_overview] tool to fetch the list of connected data sources.
2. ID RESOLUTION: Identify the correct "Client Customer ID" for Google Ads from the overview. If the user asks about Meta/Facebook, check if a Meta account ID is present in the overview.
3. EXECUTION: Use the identified ID(s) for all subsequent tool calls (get_performance_data, get_granular_analytics, etc.). Do not guess IDs.

Your capabilities include ALL Google Ads tools:
- get_unified_sources: Get all connected accounts across platforms
- get_account_overview: Get list of Google Ads accounts
- get_performance_data: Fetch historical performance data from database
- get_live_google_ads_data: Fetch live data directly from Google Ads API
- get_granular_analytics: Get detailed analytics by audience, geography, device, etc.
- transfer_to_google_sheets: Transfer data to Google Sheets for reporting
- transfer_to_meta_ads: Transfer to Meta Ads agent for cross-platform analysis

You have access to comprehensive Google Ads functionality. Always provide specific, actionable insights based on the data you retrieve.

OUTPUT GUIDELINES:
1. FORMAT: Provide the answer as a SINGLE, CONCISE PARAGRAPH. Do NOT use bullet points, numbered lists, or tables.
2. CONTENT: Summarize the key performance metrics naturally in sentences. 
3. NEXT STEPS: End by inviting the user to ask for more details or a breakdown if needed (e.g., "I can provide a detailed breakdown or a Google Sheet report if you'd like.").`;

    const modelWithTools = userModel.bindTools(adsTools);

    const response = await modelWithTools.invoke([
        new SystemMessage(systemPrompt),
        ...messages
    ], { metadata: { agentTag: 'google_ads_agent' } });

    return {
        messages: [response],
        currentAgent: "google_ads_agent",
        agentHistory: ["google_ads_agent"]
    };
};

// 3. Meta Ads Agent Node
const metaAdsAgent = async (state: typeof MultiAgentState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");
    const userModel = await createModelForUser(userId);

    const messages = state.messages;
    const systemPrompt = `You are the Meta Ads Agent, an expert in Facebook and Instagram advertising.
Use the metaTools to fetch account overviews, performance data, or live insights.

OUTPUT GUIDELINES:
1. FORMAT: Provide the answer as a SINGLE, CONCISE PARAGRAPH. Do NOT use lists or tables.
2. CONTENT: Summarize the key insights in natural language.
3. NEXT STEPS: Mention that you can provide specific details or a Google Sheet export upon request.`;

    const modelWithTools = userModel.bindTools(metaTools);
    const response = await modelWithTools.invoke([
        new SystemMessage(systemPrompt),
        ...messages
    ], { metadata: { agentTag: 'meta_ads_agent' } });

    return {
        messages: [response],
        currentAgent: "meta_ads_agent",
        agentHistory: ["meta_ads_agent"]
    };
};

// 4. Sheets Agent Node
const sheetsAgent = async (state: typeof MultiAgentState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");
    const userModel = await createModelForUser(userId);

    const messages = state.messages;
    const systemPrompt = `You are the Sheets Agent, an expert in Google Sheets automation and reporting.
Use the sheetsTools to create, read, update, or format spreadsheets. Help users organize their marketing data effectively.`;

    const modelWithTools = userModel.bindTools(sheetsTools);
    const response = await modelWithTools.invoke([
        new SystemMessage(systemPrompt),
        ...messages
    ], { metadata: { agentTag: 'sheets_agent' } });

    return {
        messages: [response],
        currentAgent: "sheets_agent",
        agentHistory: ["sheets_agent"]
    };
};

// 5. Tool Execution Node
const toolsNode = new ToolNode([
    ...adsTools,
    ...metaTools,
    ...sheetsTools,
    ...supervisorUtilityTools
]);

// 6. Response Synthesis Node
const synthesizeResponse = async (state: typeof MultiAgentState.State, config: any) => {
    const userId = config.configurable?.userId;
    if (!userId) throw new Error("User ID missing in config");
    const userModel = await createModelForUser(userId);

    const messages = state.messages;
    const lastMsg = messages[messages.length - 1];

    // If only one specialist was involved and they already provided a full answer, skip synthesis
    const specialistAgents = state.agentHistory.filter(a => a !== 'alex' && a !== 'synthesize');
    const uniqueSpecialists = Array.from(new Set(specialistAgents));

    // If only one specialist was involved, allow their response to stand as the final answer.
    // We only synthesize if multiple agents contributed conflicting or separate pieces of info.
    if (uniqueSpecialists.length === 1) {
        console.log(`[Synthesis] Single specialist (${uniqueSpecialists[0]}) detected. Skipping synthesis and passing through response.`);
        return {
            finalResponse: lastMsg.content as string
        };
    }

    if (uniqueSpecialists.length > 1) {
        const synthesisPrompt = `You are Alex synthesizing the results from specialized agents.
Please provide a BRIEF, SINGLE PARAGRAPH summary.
- Avoid lists or bullet points.
- Just state the key outcome or answer in natural sentences.
- Remind the user they can ask for details or a report if they want more info.`;

        const synthesisResponse = await userModel.invoke([
            new SystemMessage(synthesisPrompt),
            ...messages
        ], { metadata: { agentTag: 'alex' } });

        return {
            messages: [synthesisResponse],
            finalResponse: synthesisResponse.content as string
        };
    }

    // Default fallout
    return {
        finalResponse: lastMsg.content as string
    };
};

// 5. Routing Logic
const shouldContinue = (state: typeof MultiAgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    // Check for tool calls
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
    }

    // End the workflow
    return "synthesize";
};

// Graph Construction
const workflow = new StateGraph(MultiAgentState)
    .addNode("alex", alexNode)
    .addNode("google_ads_agent", googleAdsAgent)
    .addNode("meta_ads_agent", metaAdsAgent)
    .addNode("sheets_agent", sheetsAgent)
    .addNode("tools", toolsNode)
    .addNode("synthesize", synthesizeResponse)
    .addEdge("__start__", "alex")
    .addConditionalEdges("alex", (state) => {
        const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
        // If it's a tool call (either Route or Utility), go to tools
        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            // Check if it's the ROUTE tool, which alexNode already processed
            // alexNode logic moves 'currentAgent' to the destination.
            // If currentAgent is NOT alex, it means we routed to a specialist.
            const agent = state.currentAgent;
            if (agent !== 'alex') return agent;

            // If we are still 'alex', it might be a utility tool call that relies on 'tools' node to run.
            // Or it's the route tool where 'next' was 'FINISH', so we stay on 'alex' and output text.
            // If tool_calls exist but currentAgent is alex, it's typically a utility tool.
            return "tools";
        }
        // If no tool calls, it's a direct text response (Final Response)
        return "synthesize";
    })
    .addConditionalEdges("google_ads_agent", shouldContinue, {
        tools: "tools",
        synthesize: "alex" // Loop back to supervisor
    })
    .addConditionalEdges("meta_ads_agent", shouldContinue, {
        tools: "tools",
        synthesize: "alex" // Loop back to supervisor
    })
    .addConditionalEdges("sheets_agent", shouldContinue, {
        tools: "tools",
        synthesize: "alex" // Loop back to supervisor
    })
    .addConditionalEdges("tools", (state) => {
        const currentAgent = state.currentAgent;
        return currentAgent || "alex";
    })
    .addEdge("synthesize", "__end__");

export const multiAgentGraph = workflow.compile();
