import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { reflectionAgent } from '@/lib/nexus/reflection-agent';

/**
 * API endpoint for triggering reflection and analysis
 * POST /api/nexus/reflect
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const body = await request.json();
        const { action, conversationId, campaignData, days } = body;

        console.log('[Reflect API] Action:', action, 'UserId:', userId);

        switch (action) {
            case 'analyze_campaign':
                if (!campaignData) {
                    return NextResponse.json(
                        { error: 'Campaign data required' },
                        { status: 400 }
                    );
                }
                const campaignAnalysis = await reflectionAgent.analyzeCampaign({
                    userId,
                    accountId: campaignData.accountId,
                    campaignData: campaignData.campaign,
                    performanceMetrics: campaignData.metrics
                });
                return NextResponse.json({ success: true, analysis: campaignAnalysis });

            case 'learn_from_conversation':
                if (!conversationId) {
                    return NextResponse.json(
                        { error: 'Conversation ID required' },
                        { status: 400 }
                    );
                }
                const learned = await reflectionAgent.learnFromConversation(
                    conversationId,
                    userId
                );
                return NextResponse.json({ success: true, learned });

            case 'reflect_on_actions':
                const reflection = await reflectionAgent.reflectOnActions(
                    userId,
                    days || '7 days'
                );
                return NextResponse.json({ success: true, reflection });

            case 'auto_analyze':
                const insights = await reflectionAgent.autoAnalyzeRecentCampaigns(
                    userId,
                    days || 7
                );
                return NextResponse.json({ success: true, insights });

            case 'performance_summary':
                const summary = await reflectionAgent.generatePerformanceSummary(
                    userId,
                    days || 30
                );
                return NextResponse.json({ success: true, summary });

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use: analyze_campaign, learn_from_conversation, reflect_on_actions, auto_analyze, or performance_summary' },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        console.error('[Reflect API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to perform reflection', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint to retrieve reflection insights
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);

        // Generate a quick performance summary
        const summary = await reflectionAgent.generatePerformanceSummary(userId, 30);

        return NextResponse.json({ success: true, summary });
    } catch (error: any) {
        console.error('[Reflect API GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get reflection summary', details: error.message },
            { status: 500 }
        );
    }
}
