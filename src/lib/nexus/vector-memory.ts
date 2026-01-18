/**
 * DEPRECATED/REMOVED
 * VectorMemory has been removed.
 */

export class VectorMemory {
    async initialize() { }
    async storeCampaignKnowledge(...args: any[]) { }
    async storeUserContext(...args: any[]) { }
    async retrieveRelevantMemories(...args: any[]) { return []; }
}

export const vectorMemory = new VectorMemory();
