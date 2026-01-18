import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getGoogleAdsClient, getUserTokens } from '@/lib/google-ads';
import { transfer_to_meta_ads } from '@/lib/nexus/meta-tools';

// ============= GOOGLE ADS TOOLS =============

export const get_unified_sources = tool(
    async (_, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const sources = await (prisma as any).dataSource.findMany({
                where: { userId: Number(userId), status: 'active' },
                select: {
                    accountId: true,
                    accountName: true,
                    sourceType: true,
                    currency: true
                }
            });

            if (!sources || sources.length === 0) return "No connected data sources found.";

            // Group by client
            const grouped: Record<string, any[]> = {};
            sources.forEach((s: any) => {
                const client = s.clientName || 'Unassigned';
                if (!grouped[client]) grouped[client] = [];
                grouped[client].push(s);
            });

            return JSON.stringify(grouped);
        } catch (error: any) {
            return `Error fetching unified sources: ${error.message}`;
        }
    },
    {
        name: 'get_unified_sources',
        description: 'Get a comprehensive list of all connected accounts across Google Ads and Meta Ads, grouped by client name.',
        schema: z.object({})
    }
);

export const get_account_overview = tool(
    async (_, config) => {
        const userId = config.configurable?.userId;
        console.log(`[get_account_overview] Called with userId: ${userId} (${typeof userId})`);

        if (userId === undefined || userId === null) return "Error: User ID not found.";
        try {
            // 1. Try fetching from database first
            const sources = await (prisma as any).dataSource.findMany({
                where: { userId: Number(userId), sourceType: 'google-ads', status: 'active' },
                select: { accountId: true, accountName: true, currency: true }
            });
            console.log(`[get_account_overview] DB Sources found: ${sources?.length}`);

            if (sources && sources.length > 0) {
                return JSON.stringify(sources);
            }

            // 2. Fallback: Live Discovery if DB is empty
            console.log(`[get_account_overview] Fallback to Live Discovery...`);
            let discoveredAccounts = [];
            try {
                const adsClient = await getGoogleAdsClient();
                const tokens = await getUserTokens(userId);
                console.log(`[get_account_overview] Tokens retrieved: ${!!tokens}`);

                // listAccessibleCustomers only needs accessToken
                const response = await adsClient.listAccessibleCustomers(tokens.accessToken);
                console.log(`[get_account_overview] accessibleCustomers response count: ${(response as any)?.resource_names?.length || (Array.isArray(response) ? response.length : 0)}`);

                const resourceNames = (response as any).resource_names || (Array.isArray(response) ? response : []);

                for (const resourceName of resourceNames) {
                    const cleanId = resourceName.split('/')[1];
                    discoveredAccounts.push({
                        accountId: cleanId,
                        accountName: `Account ${cleanId}`,
                        currency: '---'
                    });
                }
            } catch (liveErr: any) {
                console.error(`[get_account_overview] Live discovery error:`, liveErr.message);
                return `Error during live discovery: ${liveErr.message}. Ensure GOOGLE_ADS_DEVELOPER_TOKEN is correctly configured in your environment.`;
            }

            console.log(`[get_account_overview] Live discovery results count: ${discoveredAccounts.length}`);
            if (discoveredAccounts.length === 0) {
                return "No connected Google Ads accounts found in database or via live discovery. Please connect your accounts in the Data Sources page.";
            }

            return JSON.stringify(discoveredAccounts);
        } catch (error: any) {
            console.error(`[get_account_overview] Final catch:`, error.message);
            return `Error fetching accounts: ${error.message}`;
        }
    },
    {
        name: 'get_account_overview',
        description: 'Get a list of all connected Google Ads accounts for the user.',
        schema: z.object({})
    }
);

export const get_performance_data = tool(
    async ({ accountId, metrics, startDate, endDate, groupBy }, config) => {
        const userId = config.configurable?.userId;
        if (userId === undefined || userId === null) return "Error: User ID not found in configuration.";

        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: {
                    userId: Number(userId),
                    OR: [
                        { accountId: accountId },
                        { accountId: accountId.replace(/-/g, '') },
                        { accountId: accountId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') }
                    ]
                }
            });

            if (!source) return `Account ${accountId} not found in database. Please call get_account_overview to verify your connected accounts.`;

            const dataCount = await (prisma as any).campaignMetrics.count({
                where: { dataSourceId: source.id }
            });

            if (dataCount === 0) {
                return JSON.stringify({
                    error: "NO_HISTORICAL_DATA",
                    message: "No historical data has been synced for this account yet. Historical data requires a background sync process. Use get_live_google_ads_data to fetch real-time data directly from Google Ads API instead.",
                    accountId: accountId,
                    accountName: source.accountName,
                    suggestion: "Call get_live_google_ads_data with the same parameters to get live data."
                });
            }

            const baseMetrics = new Set<string>();
            const derivedMetrics = new Set<string>();

            metrics.forEach((m: string) => {
                if (['impressions', 'clicks', 'cost', 'conversions', 'conversionValue'].includes(m)) {
                    baseMetrics.add(m);
                } else {
                    derivedMetrics.add(m);
                    if (m === 'ctr' || m === 'interactionRate') { baseMetrics.add('clicks'); baseMetrics.add('impressions'); }
                    if (m === 'cpm') { baseMetrics.add('cost'); baseMetrics.add('impressions'); }
                    if (m === 'costPerConversion') { baseMetrics.add('cost'); baseMetrics.add('conversions'); }
                    if (m === 'conversionRate') { baseMetrics.add('conversions'); baseMetrics.add('clicks'); }
                }
            });

            const selectMetrics: any = {};
            baseMetrics.forEach(m => selectMetrics[m] = true);

            const queryWhere = {
                dataSourceId: source.id,
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            };

            let rawResults;
            if (groupBy === 'campaign') {
                rawResults = await (prisma as any).campaignMetrics.groupBy({
                    by: ['campaignName'],
                    where: queryWhere,
                    _sum: selectMetrics
                });
            } else if (groupBy === 'date') {
                rawResults = await (prisma as any).campaignMetrics.groupBy({
                    by: ['date'],
                    where: queryWhere,
                    _sum: selectMetrics
                });
            } else {
                rawResults = await (prisma as any).campaignMetrics.aggregate({
                    where: queryWhere,
                    _sum: selectMetrics
                });
                rawResults = [{ _sum: rawResults._sum }];
            }

            const finalResults = rawResults.map((item: any) => {
                const data = item._sum;
                const enriched = { ...item, ...data };
                delete enriched._sum;

                if (derivedMetrics.has('ctr') || derivedMetrics.has('interactionRate')) {
                    enriched.ctr = data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) + '%' : '0.00%';
                    enriched.interactionRate = enriched.ctr;
                }
                if (derivedMetrics.has('cpm')) {
                    enriched.cpm = data.impressions > 0 ? ((data.cost / data.impressions) * 1000).toFixed(2) : '0.00';
                }
                if (derivedMetrics.has('costPerConversion')) {
                    enriched.costPerConversion = data.conversions > 0 ? (data.cost / data.conversions).toFixed(2) : '0.00';
                }
                if (derivedMetrics.has('conversionRate')) {
                    enriched.conversionRate = data.clicks > 0 ? ((data.conversions / data.clicks) * 100).toFixed(2) + '%' : '0.00%';
                }

                if (baseMetrics.has('cost')) enriched.cost = data.cost?.toFixed(2);
                if (baseMetrics.has('conversionValue')) enriched.conversionValue = data.conversionValue?.toFixed(2);

                return enriched;
            });

            return JSON.stringify(finalResults);
        } catch (error: any) {
            return `Error fetching performance data: ${error.message}`;
        }
    },
    {
        name: 'get_performance_data',
        description: 'Fetch historical Google Ads performance data from the database.',
        schema: z.object({
            accountId: z.string().describe('The Google Ads Account ID.'),
            metrics: z.array(z.string()).describe('The metrics to fetch.'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            groupBy: z.enum(['campaign', 'date']).optional()
        })
    }
);

export const get_live_google_ads_data = tool(
    async ({ accountId, metrics, startDate, endDate, groupBy, entity = 'campaign', fetchStructuredData = false }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found in configuration.";
        try {
            const client = await getGoogleAdsClient();
            const tokens = await getUserTokens(userId);
            const customerId = accountId.replace(/-/g, '');
            const source = await (prisma as any).dataSource.findFirst({
                where: {
                    userId: Number(userId),
                    OR: [
                        { accountId: accountId },
                        { accountId: customerId },
                        { accountId: accountId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') }
                    ]
                },
                select: { managerId: true }
            });

            const customer = client.Customer({
                customer_id: customerId,
                login_customer_id: source?.managerId || (tokens as any).loginCustomerId,
                refresh_token: tokens.refreshToken,
            });

            const fields = new Set<string>();
            let fromTable = 'campaign';
            if (entity === 'ad_group') {
                fromTable = 'ad_group';
                fields.add('ad_group.id'); fields.add('ad_group.name'); fields.add('ad_group.status'); fields.add('campaign.name');
            } else {
                fields.add('campaign.id'); fields.add('campaign.name'); fields.add('campaign.status');
                if (fetchStructuredData) {
                    fields.add('campaign_budget.amount_micros'); fields.add('campaign.advertising_channel_type'); fields.add('campaign.bidding_strategy_type');
                }
            }
            if (metrics && metrics.length > 0) {
                fields.add('metrics.impressions'); fields.add('metrics.clicks'); fields.add('metrics.cost_micros'); fields.add('metrics.conversions'); fields.add('metrics.conversions_value');
            }
            fields.add('segments.date');
            const gaql = `SELECT ${Array.from(fields).join(', ')} FROM ${fromTable} WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' ORDER BY segments.date DESC LIMIT 50`;

            const rows = await customer.query(gaql);
            const results = rows.map((row: any) => {
                const item: any = {};
                if (entity === 'campaign') {
                    item.id = row.campaign?.id; item.name = row.campaign?.name; item.status = row.campaign?.status;
                    if (row.campaign_budget) item.budget = (row.campaign_budget.amount_micros / 1000000).toFixed(2);
                    if (row.campaign?.advertising_channel_type) item.type = row.campaign.advertising_channel_type;
                } else if (entity === 'ad_group') {
                    item.id = row.ad_group?.id; item.name = row.ad_group?.name; item.status = row.ad_group?.status; item.campaignName = row.campaign?.name;
                }
                if (groupBy === 'date') item.date = row.segments?.date;
                if (row.metrics) {
                    const m = row.metrics;
                    item.impressions = m.impressions; item.clicks = m.clicks; item.cost = (m.cost_micros / 1000000).toFixed(2);
                    item.conversions = m.conversions; item.conversionValue = m.conversions_value;
                    item.ctr = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(2) + '%' : '0.00%';
                }
                return item;
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching live data: ${error.message}`;
        }
    },
    {
        name: 'get_live_google_ads_data',
        description: 'Fetch LIVE structural and performance data from Google Ads.',
        schema: z.object({
            accountId: z.string(),
            entity: z.enum(['campaign', 'ad_group']).optional(),
            fetchStructuredData: z.boolean().optional(),
            metrics: z.array(z.string()).optional(),
            startDate: z.string(),
            endDate: z.string(),
            groupBy: z.enum(['campaign', 'date']).optional()
        })
    }
);

export const get_granular_analytics = tool(
    async ({ accountId, campaignId, dimension, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const client = await getGoogleAdsClient();
            const tokens = await getUserTokens(userId);
            const customerId = accountId.replace(/-/g, '');
            const source = await (prisma as any).dataSource.findFirst({
                where: {
                    userId: Number(userId),
                    OR: [
                        { accountId: accountId },
                        { accountId: customerId },
                        { accountId: accountId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') }
                    ]
                },
                select: { managerId: true }
            });
            const customer = client.Customer({
                customer_id: customerId, login_customer_id: source?.managerId || (tokens as any).loginCustomerId, refresh_token: tokens.refreshToken,
            });
            const fields = new Set<string>();
            let fromTable = 'campaign';
            fields.add('campaign.id'); fields.add('campaign.name'); fields.add('segments.date');
            switch (dimension) {
                case 'audience': fromTable = 'campaign_audience_view'; fields.add('campaign_criterion.display_name'); break;
                case 'geography': fromTable = 'geographic_view'; fields.add('segments.geo_target_city'); break;
                case 'device': fromTable = 'campaign'; fields.add('segments.device'); break;
                default: fromTable = 'campaign';
            }
            fields.add('metrics.impressions'); fields.add('metrics.clicks'); fields.add('metrics.cost_micros'); fields.add('metrics.conversions');
            const whereConditions = [`segments.date BETWEEN '${startDate}' AND '${endDate}'`];
            if (campaignId && campaignId !== 'all') whereConditions.push(`campaign.id = ${campaignId}`);
            const gaql = `SELECT ${Array.from(fields).join(', ')} FROM ${fromTable} WHERE ${whereConditions.join(' AND ')} ORDER BY segments.date DESC LIMIT 500`;
            const rows = await customer.query(gaql);
            const results = rows.map((row: any) => ({
                campaign: { name: row.campaign?.name },
                metrics: { impressions: row.metrics?.impressions, clicks: row.metrics?.clicks, cost: (row.metrics?.cost_micros / 1000000).toFixed(2) },
                dimensionData: dimension === 'device' ? row.segments?.device : row.segments?.geo_target_city || row.campaign_criterion?.display_name
            }));
            return JSON.stringify(results);
        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    },
    {
        name: 'get_granular_analytics',
        description: 'Fetch detailed analytics segmented by dimension.',
        schema: z.object({
            accountId: z.string(),
            campaignId: z.string().optional(),
            dimension: z.enum(['audience', 'geography', 'time', 'device', 'campaign_structure', 'performance', 'quality_signals']),
            startDate: z.string(),
            endDate: z.string()
        })
    }
);

export const transfer_to_google_sheets = tool(
    async () => {
        return "Transferring to Google Sheets Agent...";
    },
    {
        name: 'transfer_to_google_sheets',
        description: 'Hand off control to Google Sheets Agent. Use ONLY if user explicity requests to create a sheet or export data. Do NOT use for summaries.',
        schema: z.object({})
    }
);

export const adsTools = [
    get_unified_sources,
    get_account_overview,
    get_performance_data,
    get_live_google_ads_data,
    get_granular_analytics,
    transfer_to_google_sheets,
    transfer_to_meta_ads
];
