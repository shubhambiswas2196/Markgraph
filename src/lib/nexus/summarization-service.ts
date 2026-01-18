/**
 * Summarization Service - Stubbed
 * Auto-summarization is disabled as custom memory persistence has been removed.
 */
export class SummarizationService {
    async checkAndSummarize(conversationId: number, userId: number) {
        // Disabled
        return null;
    }

    async getSummariesForContext(conversationId: number, userId: number) {
        // Disabled
        return "";
    }
}

export const summarizationService = new SummarizationService();
