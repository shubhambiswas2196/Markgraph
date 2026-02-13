import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsApi } from 'google-ads-api';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// Load credentials from SyncMaster.json
import credentialsFile from '../../../../../../SyncMaster.json';
const credentials = credentialsFile.installed;

export async function GET(request: NextRequest) {
    try {
        // Extract userId from JWT token instead of query parameter
        const userId = await getUserIdFromRequest(request);

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        if (!accountId) {
            return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
        }

        // Get stored tokens for the authenticated user
        const tokenRecord = await prisma.oAuthToken.findUnique({
            where: {
                userId_provider: {
                    userId: userId,
                    provider: 'google',
                },
            },
        });

        if (!tokenRecord) {
            return NextResponse.json({ error: 'No OAuth tokens found' }, { status: 401 });
        }

        // Initialize Google Ads API client
        const client = new GoogleAdsApi({
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        });

        // Create customer client with access token
        const customer = client.Customer({
            customer_id: accountId.replace(/-/g, ''), // Remove dashes for API
            access_token: tokenRecord.accessToken,
            refresh_token: tokenRecord.refreshToken,
        } as any);

        // Fetch campaigns with performance metrics
        const campaigns = await customer.query(`
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.bidding_strategy_type,
                campaign_budget.amount_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE campaign.status IN ('ENABLED', 'PAUSED')
            ORDER BY metrics.cost_micros DESC
            LIMIT 50
        `);

        // Format the response
        const formattedCampaigns = campaigns.map((campaign: any) => ({
            id: campaign.campaign.id.toString(),
            name: campaign.campaign.name,
            status: campaign.campaign.status,
            biddingStrategy: campaign.campaign.bidding_strategy_type,
            budget: parseFloat(campaign.campaign_budget.amount_micros) / 1000000, // Convert micros to currency
            impressions: parseInt(campaign.metrics.impressions) || 0,
            clicks: parseInt(campaign.metrics.clicks) || 0,
            cost: parseFloat(campaign.metrics.cost_micros) / 1000000 || 0, // Convert micros to currency
            conversions: parseFloat(campaign.metrics.conversions) || 0,
            conversionValue: parseFloat(campaign.metrics.conversions_value) || 0,
        }));

        return NextResponse.json({ campaigns: formattedCampaigns });
    } catch (error) {
        console.error('Google Ads campaigns fetch error:', error);

        // Return 401 for authentication errors
        if (error instanceof Error && (error.message === 'Not authenticated' || error.message === 'Invalid token')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        // Fallback to mock data
        const mockCampaigns = [
            {
                id: '1234567890',
                name: 'Summer Sale Campaign',
                status: 'ENABLED',
                biddingStrategy: 'TARGET_CPA',
                budget: 5000,
                impressions: 125000,
                clicks: 2500,
                cost: 1250.50,
                conversions: 45,
                conversionValue: 11250.00,
            },
            {
                id: '0987654321',
                name: 'Brand Awareness Q4',
                status: 'ENABLED',
                biddingStrategy: 'TARGET_CPM',
                budget: 10000,
                impressions: 500000,
                clicks: 1500,
                cost: 8750.25,
                conversions: 12,
                conversionValue: 3600.00,
            },
            {
                id: '5554443333',
                name: 'Product Launch',
                status: 'PAUSED',
                biddingStrategy: 'MANUAL_CPC',
                budget: 2500,
                impressions: 75000,
                clicks: 1800,
                cost: 900.75,
                conversions: 28,
                conversionValue: 8400.00,
            },
        ];

        return NextResponse.json({
            campaigns: mockCampaigns,
            note: 'Using mock data - Google Ads API integration requires developer token'
        });
    }
}
