import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const recall_memory = tool(async ({ query }) => {
    return "Memory recall disabled.";
}, {
    name: "recall_memory",
    description: "Search for relevant past information.",
    schema: z.object({
        query: z.string().describe("The search query.")
    })
});

export const save_preference = tool(async ({ key, value }) => {
    return "Preference saving disabled.";
}, {
    name: "save_preference",
    description: "Save a user preference.",
    schema: z.object({
        key: z.string(),
        value: z.string()
    })
});

export const memoryTools = [recall_memory, save_preference];
