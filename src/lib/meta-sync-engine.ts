import prisma from '@/lib/prisma';
import { getMetaInsights, getMetaCampaigns, getMetaAdSets, getMetaAds } from './meta-ads';
import { getUserMetaTokens } from './meta-oauth';

/**
 * Syncs Meta Ads data for a specific user and account
 */
export async function syncMetaAdsData(userId: number, accountId: string) {
    console.log(`[Meta Sync] Starting sync for user ${userId}, account ${accountId}`);
    
    try {
        // 1. Get tokens
        const tokens = await getUserMetaTokens(userId);
        
        // 2. Update sync status
        const dataSource = await (prisma as any).dataSource.findFirst({
            where: {
                userId,
                sourceType: 'meta-ads',
                accountId
            }
        });

        if (!dataSource) {
            throw new Error(`Data source not found for account ${accountId}`);
        }

        await (prisma as any).dataSource.update({
            where: { id: dataSource.id },
            data: { syncStatus: 'SYNCING' }
        });

        // 3. Define date range (last 30 days for sync)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const timeRange = {
            since: startDate.toISOString().split('T')[0],
            until: endDate.toISOString().split('T')[0]
        };

        // 4. Sync Campaigns
        console.log('[Meta Sync] Syncing campaigns...');
        const campaigns = await getMetaCampaigns(tokens.accessToken, accountId);
        
        // Fetch daily insights for campaigns
        console.log('[Meta Sync] Fetching daily campaign insights...');
        const dailyCampaignInsights = await getMetaInsights(tokens.accessToken, {
            accountId,
            level: 'campaign',
            timeRange,
            fields: ['campaign_id', 'campaign_name', 'impressions', 'clicks', 'spend', 'reach', 'frequency', 'actions', 'action_values'],
            breakdowns: [], 
        });
        
        for (const row of dailyCampaignInsights) {
             const campaign = campaigns.find((c: any) => c.id === row.campaign_id) || { name: row.campaign_name, status: 'UNKNOWN', objective: 'UNKNOWN' };
             
             let conversions = 0;
             if (row.actions) {
                 const action = row.actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
                 if (action) conversions = parseInt(action.value);
             }
 
             let conversionValue = 0;
             if (row.action_values) {
                 const action = row.action_values.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
                 if (action) conversionValue = parseFloat(action.value);
             }

             const spend = parseFloat(row.spend || 0);
             const impressions = parseInt(row.impressions || 0);
             const clicks = parseInt(row.clicks || 0);

             // Calculate derived
             const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
             const cpc = clicks > 0 ? spend / clicks : 0;
             const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

             await (prisma as any).metaCampaignMetrics.upsert({
                 where: {
                     dataSourceId_campaignId_date: {
                         dataSourceId: dataSource.id,
                         campaignId: row.campaign_id,
                         // Since we are fetching aggregate for now (API wrapper doesn't support time_increment param easily yet),
                         // we store it as today's date to represent "Latest 30 Day Snapshot". 
                         // To do true daily sync, we'd need to update getMetaInsights to allow time_increment='1'.
                         date: new Date(endDate.toISOString().split('T')[0]) 
                     }
                 },
                 update: {
                     campaignName: row.campaign_name,
                     status: campaign.status,
                     objective: campaign.objective,
                     impressions,
                     clicks,
                     spend,
                     reach: parseInt(row.reach || 0),
                     frequency: parseFloat(row.frequency || 0),
                     conversions,
                     conversionValue,
                     ctr,
                     cpc,
                     cpm
                 },
                 create: {
                     dataSourceId: dataSource.id,
                     campaignId: row.campaign_id,
                     campaignName: row.campaign_name,
                     status: campaign.status || 'UNKNOWN',
                     objective: campaign.objective || 'UNKNOWN',
                     date: new Date(endDate.toISOString().split('T')[0]),
                     impressions,
                     clicks,
                     spend,
                     reach: parseInt(row.reach || 0),
                     frequency: parseFloat(row.frequency || 0),
                     conversions,
                     conversionValue,
                     ctr,
                     cpc,
                     cpm
                 }
             });
        }

        // 5. Update final status
        await (prisma as any).dataSource.update({
            where: { id: dataSource.id },
            data: { 
                syncStatus: 'COMPLETED',
                lastSyncedAt: new Date()
            }
        });

        console.log('[Meta Sync] Sync completed successfully');
        return { success: true };

    } catch (error) {
        console.error('[Meta Sync] Error:', error);
        
        // Update status to FAILED
        await (prisma as any).dataSource.updateMany({
            where: { 
                userId, 
                sourceType: 'meta-ads', 
                accountId 
            },
            data: { 
                syncStatus: 'FAILED',
            }
        });

        throw error;
    }
}
