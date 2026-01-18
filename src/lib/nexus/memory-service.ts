/**
 * DEPRECATED/REMOVED
 * MemoryService has been removed.
 */

export class MemoryService {
    async getUserPreferences(...args: any[]) { return []; }
    async setPreference(...args: any[]) { }
    async learnPreference(...args: any[]) { }
    async getCampaignInsights(...args: any[]) { return []; }
    async addInsight(...args: any[]) { }
    async createSummary(...args: any[]) { }
    async getConversationSummaries(...args: any[]) { return []; }
    async logAction(...args: any[]) { }
    async getAgentHistory(...args: any[]) { return []; }
    async getSuccessfulActions(...args: any[]) { return []; }
}

export const memoryService = new MemoryService();
