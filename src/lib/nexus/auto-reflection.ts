/**
 * Scheduled task to automatically analyze campaigns and learn from data
 * This can be triggered by a cron job or manually
 */

import { reflectionAgent } from '@/lib/nexus/reflection-agent';
import prisma from '@/lib/prisma';

export async function runAutomaticReflection() {
    console.log('[AutoReflection] Starting automatic reflection task');

    try {
        // Get all active users
        const users = await (prisma as any).user.findMany({
            select: { id: true, email: true }
        });

        console.log(`[AutoReflection] Processing ${users.length} users`);

        for (const user of users) {
            try {
                // Auto-analyze recent campaigns
                await reflectionAgent.autoAnalyzeRecentCampaigns(user.id, 7);

                // Reflect on recent actions
                await reflectionAgent.reflectOnActions(user.id, '7 days');

                // Learn from recent conversations
                const recentConversations = await (prisma as any).conversation.findMany({
                    where: { userId: user.id },
                    orderBy: { updatedAt: 'desc' },
                    take: 3
                });

                for (const conv of recentConversations) {
                    await reflectionAgent.learnFromConversation(conv.id, user.id);
                }

                console.log(`[AutoReflection] Completed reflection for user ${user.id}`);
            } catch (userError) {
                console.error(`[AutoReflection] Error processing user ${user.id}:`, userError);
                // Continue with next user
            }
        }

        console.log('[AutoReflection] Automatic reflection completed');
        return { success: true, usersProcessed: users.length };
    } catch (error) {
        console.error('[AutoReflection] Fatal error:', error);
        return { success: false, error };
    }
}

// Export for use in API routes or cron jobs
export default runAutomaticReflection;
