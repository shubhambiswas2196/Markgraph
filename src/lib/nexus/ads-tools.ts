import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getGoogleAdsClient, getUserTokens } from '@/lib/google-ads';
import { transfer_to_meta_ads } from '@/lib/nexus/meta-tools';


const normalizeAccountId = (accountId: string) => accountId.replace(/-/g, '');
const microsToUnits = (micros?: number) => {
    if (micros === undefined || micros === null) return 0;
    return Number(micros) / 1_000_000;
};

const getGoogleSource = async (userId: number | string, accountId: string) => {
    const normalized = normalizeAccountId(accountId);
    return prisma.dataSource.findFirst({
        where: {
            userId: Number(userId),
            sourceType: 'google-ads',
            OR: [
                { accountId: accountId },
                { accountId: normalized },
                { accountId: accountId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') }
            ]
        }
    });
};

const getGoogleCustomer = async (userId: number | string, accountId: string) => {
    const client = await getGoogleAdsClient();
    const tokens = await getUserTokens(userId);
    const source = await getGoogleSource(userId, accountId);
    const customerId = normalizeAccountId(accountId);

    return client.Customer({
        customer_id: customerId,
        login_customer_id: source?.managerId || (tokens as any).loginCustomerId,
        refresh_token: tokens.refreshToken,
    });
};
// ============= GOOGLE ADS TOOLS =============

export const get_unified_sources = tool(
    async (_, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const sources = await prisma.dataSource.findMany({
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
            const sources = await prisma.dataSource.findMany({
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
                return "No connected Google Ads accounts found. Please go to the [Data Sources](/sources) page to connect your Google Ads account so I can analyze your data.";
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
            const source = await prisma.dataSource.findFirst({
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

            const dataCount = await prisma.campaignMetrics.count({
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
                rawResults = await prisma.campaignMetrics.groupBy({
                    by: ['campaignName'],
                    where: queryWhere,
                    _sum: selectMetrics
                });
            } else if (groupBy === 'date') {
                rawResults = await prisma.campaignMetrics.groupBy({
                    by: ['date'],
                    where: queryWhere,
                    _sum: selectMetrics
                });
            } else {
                rawResults = await prisma.campaignMetrics.aggregate({
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
        console.log(`[AdsTool] get_live_google_ads_data called for user ${userId} with accountId: ${accountId}`);

        if (!userId) return "Error: User ID not found in configuration.";
        try {
            const client = await getGoogleAdsClient();
            const tokens = await getUserTokens(userId);
            const customerId = accountId.replace(/-/g, '');

            console.log(`[AdsTool] Looking up source for accountId: ${accountId}`);
            const source = await prisma.dataSource.findFirst({
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
            console.log(`[AdsTool] Source found: ${!!source}, ManagerId: ${source?.managerId}`);

            const customer = client.Customer({
                customer_id: customerId,
                login_customer_id: source?.managerId || (tokens as any).loginCustomerId,
                refresh_token: tokens.refreshToken,
            });

            // ... (fields logic) ...
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

            console.log(`[AdsTool] Executing GAQL: ${gaql}`);
            const rows = await customer.query(gaql);
            console.log(`[AdsTool] GAQL Success. Rows: ${rows.length}`);
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
            const source = await prisma.dataSource.findFirst({
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

export const google_keyword_quality_score_audit = tool(
    async ({ accountId, startDate, endDate, maxResults = 50, maxQualityScore = 6 }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const limit = Math.max(1, Math.min(Number(maxResults), 500));
            const qsThreshold = Number(maxQualityScore);

            const gaql = `
                SELECT
                    campaign.name,
                    ad_group.name,
                    ad_group_criterion.keyword.text,
                    ad_group_criterion.keyword.match_type,
                    ad_group_criterion.quality_info.quality_score,
                    ad_group_criterion.quality_info.creative_quality_score,
                    ad_group_criterion.quality_info.landing_page_quality_score,
                    ad_group_criterion.quality_info.post_click_quality_score,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros
                FROM keyword_view
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                  AND ad_group_criterion.negative = false
                  AND ad_group_criterion.quality_info.quality_score IS NOT NULL
                  AND ad_group_criterion.quality_info.quality_score <= ${qsThreshold}
                ORDER BY ad_group_criterion.quality_info.quality_score ASC
                LIMIT ${limit}
            `;
            const rows = await customer.query(gaql);
            const results = rows.map((row: any) => ({
                campaign: row.campaign?.name,
                adGroup: row.ad_group?.name,
                keyword: row.ad_group_criterion?.keyword?.text,
                matchType: row.ad_group_criterion?.keyword?.match_type,
                qualityScore: row.ad_group_criterion?.quality_info?.quality_score ?? null,
                creativeQuality: row.ad_group_criterion?.quality_info?.creative_quality_score ?? null,
                landingPageQuality: row.ad_group_criterion?.quality_info?.landing_page_quality_score ?? null,
                postClickQuality: row.ad_group_criterion?.quality_info?.post_click_quality_score ?? null,
                impressions: row.metrics?.impressions ?? 0,
                clicks: row.metrics?.clicks ?? 0,
                cost: microsToUnits(row.metrics?.cost_micros).toFixed(2)
            }));

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching quality score data: ${error.message}`;
        }
    },
    {
        name: 'google_keyword_quality_score_audit',
        description: 'Audit Google Ads keyword Quality Score and return low-scoring keywords with diagnostics.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            maxResults: z.number().optional().describe('Max rows to return (default 50)'),
            maxQualityScore: z.number().optional().describe('Return keywords with Quality Score <= this value (default 6)')
        })
    }
);

export const google_negative_keywords_audit = tool(
    async ({ accountId }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);

            const campaignGaql = `
                SELECT
                    campaign.id,
                    campaign.name,
                    campaign_criterion.keyword.text,
                    campaign_criterion.keyword.match_type
                FROM campaign_criterion
                WHERE campaign_criterion.negative = true
                  AND campaign_criterion.type = KEYWORD
            `;

            const adGroupGaql = `
                SELECT
                    campaign.id,
                    campaign.name,
                    ad_group.id,
                    ad_group.name,
                    ad_group_criterion.keyword.text,
                    ad_group_criterion.keyword.match_type
                FROM ad_group_criterion
                WHERE ad_group_criterion.negative = true
                  AND ad_group_criterion.type = KEYWORD
            `;

            const [campaignRows, adGroupRows] = await Promise.all([
                customer.query(campaignGaql),
                customer.query(adGroupGaql)
            ]);

            const campaignNegatives = campaignRows.map((row: any) => ({
                level: 'campaign',
                campaignId: row.campaign?.id,
                campaign: row.campaign?.name,
                keyword: row.campaign_criterion?.keyword?.text,
                matchType: row.campaign_criterion?.keyword?.match_type
            }));

            const adGroupNegatives = adGroupRows.map((row: any) => ({
                level: 'ad_group',
                campaignId: row.campaign?.id,
                campaign: row.campaign?.name,
                adGroupId: row.ad_group?.id,
                adGroup: row.ad_group?.name,
                keyword: row.ad_group_criterion?.keyword?.text,
                matchType: row.ad_group_criterion?.keyword?.match_type
            }));

            return JSON.stringify({ campaignNegatives, adGroupNegatives });
        } catch (error: any) {
            return `Error fetching negative keywords: ${error.message}`;
        }
    },
    {
        name: 'google_negative_keywords_audit',
        description: 'List campaign-level and ad-group-level negative keywords in Google Ads.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID')
        })
    }
);

export const google_keyword_match_bid_audit = tool(
    async ({ accountId, startDate, endDate, maxResults = 200 }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const gaql = `
                SELECT
                    campaign.name,
                    ad_group.name,
                    ad_group_criterion.keyword.text,
                    ad_group_criterion.keyword.match_type,
                    ad_group_criterion.cpc_bid_micros,
                    ad_group_criterion.effective_cpc_bid_micros,
                    metrics.average_cpc,
                    metrics.impressions,
                    metrics.clicks
                FROM keyword_view
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                  AND ad_group_criterion.negative = false
                ORDER BY metrics.impressions DESC
                LIMIT ${Math.max(1, Math.min(maxResults, 1000))}
            `;

            const rows = await customer.query(gaql);
            const results = rows.map((row: any) => {
                const bidMicros = row.ad_group_criterion?.cpc_bid_micros ?? row.ad_group_criterion?.effective_cpc_bid_micros ?? 0;
                const avgCpcMicros = row.metrics?.average_cpc ?? 0;
                const bid = microsToUnits(bidMicros);
                const avgCpc = microsToUnits(avgCpcMicros);
                let status = 'ok';
                if (!bid) status = 'no_bid_set';
                else if (avgCpc >= bid * 0.9) status = 'bid_may_be_low';
                else if (avgCpc < bid * 0.5) status = 'bid_may_be_high';

                return {
                    campaign: row.campaign?.name,
                    adGroup: row.ad_group?.name,
                    keyword: row.ad_group_criterion?.keyword?.text,
                    matchType: row.ad_group_criterion?.keyword?.match_type,
                    bid: bid ? bid.toFixed(2) : null,
                    avgCpc: avgCpc ? avgCpc.toFixed(2) : null,
                    impressions: row.metrics?.impressions ?? 0,
                    clicks: row.metrics?.clicks ?? 0,
                    status
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching keyword bid data: ${error.message}`;
        }
    },
    {
        name: 'google_keyword_match_bid_audit',
        description: 'Check keyword match types and bid sufficiency using average CPC vs bid.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            maxResults: z.number().optional().describe('Max rows to return (default 200)')
        })
    }
);

export const google_duplicate_ad_copy_audit = tool(
    async ({ accountId, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const gaql = `
                SELECT
                    campaign.name,
                    ad_group.id,
                    ad_group.name,
                    ad_group_ad.ad.id,
                    ad_group_ad.status,
                    ad_group_ad.ad.type,
                    ad_group_ad.ad.expanded_text_ad.headline_part1,
                    ad_group_ad.ad.expanded_text_ad.headline_part2,
                    ad_group_ad.ad.expanded_text_ad.headline_part3,
                    ad_group_ad.ad.expanded_text_ad.description,
                    ad_group_ad.ad.expanded_text_ad.description2,
                    ad_group_ad.ad.responsive_search_ad.headlines,
                    ad_group_ad.ad.responsive_search_ad.descriptions
                FROM ad_group_ad
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            `;

            const rows = await customer.query(gaql);
            const grouped: Record<string, any[]> = {};

            const normalizeText = (value: string) =>
                value.toLowerCase().replace(/\s+/g, ' ').trim();

            rows.forEach((row: any) => {
                const ad = row.ad_group_ad?.ad;
                const adGroupId = row.ad_group?.id;
                if (!adGroupId || !ad) return;

                let text = '';
                if (ad.responsive_search_ad) {
                    const headlines = (ad.responsive_search_ad.headlines || []).map((h: any) => h.text).join('|');
                    const descriptions = (ad.responsive_search_ad.descriptions || []).map((d: any) => d.text).join('|');
                    text = `${headlines}||${descriptions}`;
                } else if (ad.expanded_text_ad) {
                    text = [
                        ad.expanded_text_ad.headline_part1,
                        ad.expanded_text_ad.headline_part2,
                        ad.expanded_text_ad.headline_part3,
                        ad.expanded_text_ad.description,
                        ad.expanded_text_ad.description2
                    ].filter(Boolean).join('|');
                }

                if (!text) return;
                const key = `${adGroupId}::${normalizeText(text)}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push({
                    campaign: row.campaign?.name,
                    adGroupId,
                    adGroup: row.ad_group?.name,
                    adId: ad.id,
                    adType: ad.type,
                    status: row.ad_group_ad?.status
                });
            });

            const duplicates = Object.values(grouped).filter(items => items.length > 1);
            return JSON.stringify(duplicates);
        } catch (error: any) {
            return `Error fetching ad copy data: ${error.message}`;
        }
    },
    {
        name: 'google_duplicate_ad_copy_audit',
        description: 'Detect duplicate ad copy within the same ad group (Google Ads).',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD')
        })
    }
);

export const google_ad_group_performance = tool(
    async ({ accountId, startDate, endDate, minSpend = 0, maxCPA }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const source = await getGoogleSource(userId, accountId);
            if (!source) return `Account ${accountId} not found in database.`;

            const rows = await prisma.adGroupMetrics.groupBy({
                by: ['adGroupId', 'adGroupName', 'campaignId'],
                where: {
                    dataSourceId: source.id,
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                },
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true,
                    conversionValue: true
                }
            });

            const results = rows.map((row: any) => {
                const impressions = row._sum.impressions || 0;
                const clicks = row._sum.clicks || 0;
                const cost = row._sum.cost || 0;
                const conversions = row._sum.conversions || 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpa = conversions > 0 ? cost / conversions : null;
                let status = 'ok';
                if (cost >= minSpend && conversions === 0) status = 'no_conversions';
                if (maxCPA !== undefined && cpa !== null && cpa > maxCPA) status = 'high_cpa';

                return {
                    adGroupId: row.adGroupId,
                    adGroup: row.adGroupName,
                    campaignId: row.campaignId,
                    impressions,
                    clicks,
                    cost: cost.toFixed(2),
                    conversions,
                    conversionValue: (row._sum.conversionValue || 0).toFixed(2),
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null,
                    status
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching ad group performance: ${error.message}`;
        }
    },
    {
        name: 'google_ad_group_performance',
        description: 'Analyze Google Ads ad group performance (impressions, clicks, cost, CPA).',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            minSpend: z.number().optional().describe('Flag no-conversion groups above this spend'),
            maxCPA: z.number().optional().describe('Flag groups with CPA above this value')
        })
    }
);

export const google_campaign_cpa_no_leads_audit = tool(
    async ({ accountId, startDate, endDate, minSpend = 0, maxCPA }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const source = await getGoogleSource(userId, accountId);
            if (!source) return `Account ${accountId} not found in database.`;

            const rows = await prisma.campaignMetrics.groupBy({
                by: ['campaignId', 'campaignName'],
                where: {
                    dataSourceId: source.id,
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                },
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true
                }
            });

            const results = rows.map((row: any) => {
                const cost = row._sum.cost || 0;
                const conversions = row._sum.conversions || 0;
                const cpa = conversions > 0 ? cost / conversions : null;
                let status = 'ok';
                if (cost >= minSpend && conversions === 0) status = 'no_conversions';
                if (maxCPA !== undefined && cpa !== null && cpa > maxCPA) status = 'high_cpa';

                return {
                    campaignId: row.campaignId,
                    campaign: row.campaignName,
                    impressions: row._sum.impressions || 0,
                    clicks: row._sum.clicks || 0,
                    cost: cost.toFixed(2),
                    conversions,
                    cpa: cpa !== null ? cpa.toFixed(2) : null,
                    status
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching campaign CPA data: ${error.message}`;
        }
    },
    {
        name: 'google_campaign_cpa_no_leads_audit',
        description: 'Find campaigns with high CPA or zero conversions in Google Ads.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            minSpend: z.number().optional().describe('Flag no-conversion campaigns above this spend'),
            maxCPA: z.number().optional().describe('Flag campaigns with CPA above this value')
        })
    }
);

export const google_location_performance = tool(
    async ({ accountId, startDate, endDate, level = 'country' }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const source = await getGoogleSource(userId, accountId);
            if (!source) return `Account ${accountId} not found in database.`;

            const byFields = level === 'city'
                ? ['country', 'region', 'city']
                : level === 'region'
                    ? ['country', 'region']
                    : ['country'];

            const rows = await prisma.locationMetrics.groupBy({
                by: byFields as any,
                where: {
                    dataSourceId: source.id,
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                },
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true,
                    conversionValue: true
                }
            });

            const results = rows.map((row: any) => {
                const impressions = row._sum.impressions || 0;
                const clicks = row._sum.clicks || 0;
                const cost = row._sum.cost || 0;
                const conversions = row._sum.conversions || 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpa = conversions > 0 ? cost / conversions : null;

                return {
                    country: row.country,
                    region: row.region,
                    city: row.city,
                    impressions,
                    clicks,
                    cost: cost.toFixed(2),
                    conversions,
                    conversionValue: (row._sum.conversionValue || 0).toFixed(2),
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching location performance: ${error.message}`;
        }
    },
    {
        name: 'google_location_performance',
        description: 'Analyze Google Ads performance by location (country/region/city).',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            level: z.enum(['country', 'region', 'city']).optional()
        })
    }
);

export const google_device_performance = tool(
    async ({ accountId, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const source = await getGoogleSource(userId, accountId);
            if (!source) return `Account ${accountId} not found in database.`;

            const rows = await prisma.deviceMetrics.groupBy({
                by: ['device'],
                where: {
                    dataSourceId: source.id,
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                },
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true,
                    conversionValue: true
                }
            });

            const results = rows.map((row: any) => {
                const impressions = row._sum.impressions || 0;
                const clicks = row._sum.clicks || 0;
                const cost = row._sum.cost || 0;
                const conversions = row._sum.conversions || 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpa = conversions > 0 ? cost / conversions : null;

                return {
                    device: row.device,
                    impressions,
                    clicks,
                    cost: cost.toFixed(2),
                    conversions,
                    conversionValue: (row._sum.conversionValue || 0).toFixed(2),
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching device performance: ${error.message}`;
        }
    },
    {
        name: 'google_device_performance',
        description: 'Analyze Google Ads performance by device.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD')
        })
    }
);

export const google_demographics_performance = tool(
    async ({ accountId, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const source = await getGoogleSource(userId, accountId);
            if (!source) return `Account ${accountId} not found in database.`;

            const [ageRows, genderRows] = await Promise.all([
                prisma.ageRangeMetrics.groupBy({
                    by: ['ageRange'],
                    where: {
                        dataSourceId: source.id,
                        date: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    },
                    _sum: {
                        impressions: true,
                        clicks: true,
                        cost: true,
                        conversions: true,
                        conversionValue: true
                    }
                }),
                prisma.genderMetrics.groupBy({
                    by: ['gender'],
                    where: {
                        dataSourceId: source.id,
                        date: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    },
                    _sum: {
                        impressions: true,
                        clicks: true,
                        cost: true,
                        conversions: true,
                        conversionValue: true
                    }
                })
            ]);

            const buildMetricRow = (labelKey: 'ageRange' | 'gender', row: any) => {
                const impressions = row._sum.impressions || 0;
                const clicks = row._sum.clicks || 0;
                const cost = row._sum.cost || 0;
                const conversions = row._sum.conversions || 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpa = conversions > 0 ? cost / conversions : null;
                return {
                    [labelKey]: row[labelKey],
                    impressions,
                    clicks,
                    cost: cost.toFixed(2),
                    conversions,
                    conversionValue: (row._sum.conversionValue || 0).toFixed(2),
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            };

            return JSON.stringify({
                ageRanges: ageRows.map((row: any) => buildMetricRow('ageRange', row)),
                genders: genderRows.map((row: any) => buildMetricRow('gender', row))
            });
        } catch (error: any) {
            return `Error fetching demographic performance: ${error.message}`;
        }
    },
    {
        name: 'google_demographics_performance',
        description: 'Analyze Google Ads performance by age range and gender.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD')
        })
    }
);

export const google_audience_performance = tool(
    async ({ accountId, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const gaql = `
                SELECT
                    campaign.name,
                    campaign_criterion.display_name,
                    campaign_criterion.type,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM campaign_audience_view
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY metrics.impressions DESC
            `;

            const rows = await customer.query(gaql);
            const results = rows.map((row: any) => {
                const impressions = row.metrics?.impressions || 0;
                const clicks = row.metrics?.clicks || 0;
                const cost = microsToUnits(row.metrics?.cost_micros);
                const conversions = row.metrics?.conversions || 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpa = conversions > 0 ? cost / conversions : null;

                return {
                    campaign: row.campaign?.name,
                    audience: row.campaign_criterion?.display_name,
                    audienceType: row.campaign_criterion?.type,
                    impressions,
                    clicks,
                    cost: cost.toFixed(2),
                    conversions,
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching audience performance: ${error.message}`;
        }
    },
    {
        name: 'google_audience_performance',
        description: 'Analyze Google Ads audience performance from campaign audience view.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD')
        })
    }
);

export const google_network_performance = tool(
    async ({ accountId, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const gaql = `
                SELECT
                    segments.ad_network_type,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM campaign
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            `;

            const rows = await customer.query(gaql);
            const aggregated: Record<string, any> = {};

            rows.forEach((row: any) => {
                const key = row.segments?.ad_network_type || 'UNKNOWN';
                if (!aggregated[key]) {
                    aggregated[key] = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
                }
                aggregated[key].impressions += row.metrics?.impressions || 0;
                aggregated[key].clicks += row.metrics?.clicks || 0;
                aggregated[key].cost += microsToUnits(row.metrics?.cost_micros);
                aggregated[key].conversions += row.metrics?.conversions || 0;
            });

            const results = Object.entries(aggregated).map(([network, stats]: any) => {
                const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
                const cpa = stats.conversions > 0 ? stats.cost / stats.conversions : null;
                return {
                    network,
                    impressions: stats.impressions,
                    clicks: stats.clicks,
                    cost: stats.cost.toFixed(2),
                    conversions: stats.conversions,
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching network performance: ${error.message}`;
        }
    },
    {
        name: 'google_network_performance',
        description: 'Analyze Google Ads performance by network (Search, Display, etc.).',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD')
        })
    }
);

export const google_time_of_day_performance = tool(
    async ({ accountId, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const gaql = `
                SELECT
                    segments.hour,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM campaign
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            `;

            const rows = await customer.query(gaql);
            const aggregated: Record<string, any> = {};

            rows.forEach((row: any) => {
                const hour = row.segments?.hour ?? 'UNKNOWN';
                if (!aggregated[hour]) {
                    aggregated[hour] = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
                }
                aggregated[hour].impressions += row.metrics?.impressions || 0;
                aggregated[hour].clicks += row.metrics?.clicks || 0;
                aggregated[hour].cost += microsToUnits(row.metrics?.cost_micros);
                aggregated[hour].conversions += row.metrics?.conversions || 0;
            });

            const results = Object.entries(aggregated).map(([hour, stats]: any) => {
                const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
                const cpa = stats.conversions > 0 ? stats.cost / stats.conversions : null;
                return {
                    hour,
                    impressions: stats.impressions,
                    clicks: stats.clicks,
                    cost: stats.cost.toFixed(2),
                    conversions: stats.conversions,
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching time-of-day performance: ${error.message}`;
        }
    },
    {
        name: 'google_time_of_day_performance',
        description: 'Analyze Google Ads performance by hour of day.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD')
        })
    }
);

export const google_ad_schedule_performance = tool(
    async ({ accountId, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const gaql = `
                SELECT
                    segments.day_of_week,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM campaign
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            `;

            const rows = await customer.query(gaql);
            const aggregated: Record<string, any> = {};

            rows.forEach((row: any) => {
                const day = row.segments?.day_of_week || 'UNKNOWN';
                if (!aggregated[day]) {
                    aggregated[day] = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
                }
                aggregated[day].impressions += row.metrics?.impressions || 0;
                aggregated[day].clicks += row.metrics?.clicks || 0;
                aggregated[day].cost += microsToUnits(row.metrics?.cost_micros);
                aggregated[day].conversions += row.metrics?.conversions || 0;
            });

            const results = Object.entries(aggregated).map(([day, stats]: any) => {
                const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
                const cpa = stats.conversions > 0 ? stats.cost / stats.conversions : null;
                return {
                    dayOfWeek: day,
                    impressions: stats.impressions,
                    clicks: stats.clicks,
                    cost: stats.cost.toFixed(2),
                    conversions: stats.conversions,
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching ad schedule performance: ${error.message}`;
        }
    },
    {
        name: 'google_ad_schedule_performance',
        description: 'Analyze Google Ads performance by day of week (ad scheduling).',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD')
        })
    }
);

export const google_placement_performance = tool(
    async ({ accountId, startDate, endDate, maxResults = 200 }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const customer = await getGoogleCustomer(userId, accountId);
            const gaql = `
                SELECT
                    detail_placement_view.placement,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions
                FROM detail_placement_view
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY metrics.impressions DESC
                LIMIT ${Math.max(1, Math.min(maxResults, 1000))}
            `;

            const rows = await customer.query(gaql);
            const results = rows.map((row: any) => {
                const impressions = row.metrics?.impressions || 0;
                const clicks = row.metrics?.clicks || 0;
                const cost = microsToUnits(row.metrics?.cost_micros);
                const conversions = row.metrics?.conversions || 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpa = conversions > 0 ? cost / conversions : null;
                return {
                    placement: row.detail_placement_view?.placement,
                    impressions,
                    clicks,
                    cost: cost.toFixed(2),
                    conversions,
                    ctr: ctr.toFixed(2) + '%',
                    cpa: cpa !== null ? cpa.toFixed(2) : null
                };
            });

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching placement performance: ${error.message}`;
        }
    },
    {
        name: 'google_placement_performance',
        description: 'Analyze Google Ads placement performance for display/video placements.',
        schema: z.object({
            accountId: z.string().describe('Google Ads Account ID'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            maxResults: z.number().optional().describe('Max rows to return (default 200)')
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
    google_keyword_quality_score_audit,
    google_negative_keywords_audit,
    google_keyword_match_bid_audit,
    google_duplicate_ad_copy_audit,
    google_ad_group_performance,
    google_campaign_cpa_no_leads_audit,
    google_location_performance,
    google_device_performance,
    google_demographics_performance,
    google_audience_performance,
    google_network_performance,
    google_time_of_day_performance,
    google_ad_schedule_performance,
    google_placement_performance,
    transfer_to_google_sheets,
    transfer_to_meta_ads
];
