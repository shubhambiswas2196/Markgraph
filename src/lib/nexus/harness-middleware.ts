/**
 * HarnessMiddleware: Manages large tool result eviction.
 * If a tool output exceeds the token/char limit, it evicts the result
 * to an ephemeral storage and returns a reference/preview to the agent.
 */

import { ToolMessage } from '@langchain/core/messages';

const MAX_TOOL_CHARS = 15000; // Roughly 4k-5k tokens

export const handleLargeResultEviction = (toolMessage: ToolMessage) => {
    const content = typeof toolMessage.content === 'string'
        ? toolMessage.content
        : JSON.stringify(toolMessage.content);

    if (content.length > MAX_TOOL_CHARS) {
        const preview = content.substring(0, 1000) + "... [Result Truncated for token efficiency]";
        const fullLength = content.length;

        // In a real Harness, we'd save to a backend 'FilesystemBackend' here.
        // For now, we decorate the message with metadata so the agent knows it was evicted.

        const evictedMessage = new ToolMessage({
            ...toolMessage,
            content: `${preview}\n\n[NOTICE: This result was ${fullLength} characters long and has been evicted to ephemeral memory. Use 'read_evicted_result' if you need the full data.]`,
            additional_kwargs: {
                ...toolMessage.additional_kwargs,
                isEvicted: true,
                fullContent: content // Still in memory for now, but stripped from the LLM prompt by our custom state logic
            }
        } as any);

        return evictedMessage;
    }

    return toolMessage;
};
