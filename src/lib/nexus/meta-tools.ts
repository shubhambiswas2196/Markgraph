import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getMetaAdAccounts, getMetaInsights } from '@/lib/meta-ads';
import { getUserMetaTokens } from '@/lib/meta-oauth';

// ============= META ADS TOOLS =============

export const get_meta_account_overview = tool(
    async (_, config) => {
        const userId = config.configurable?.userId;
        console.log(`[get_meta_account_overview] Called with userId: ${userId}`);

        if (userId === undefined || userId === null) return "Error: User ID not found.";
        try {
            // 1. Try fetching from database first
            const sources = await (prisma as any).dataSource.findMany({
                where: { userId: Number(userId), sourceType: 'meta-ads', status: 'active' },
                select: { accountId: true, accountName: true, currency: true, clientName: true }
            });
            console.log(`[get_meta_account_overview] DB Sources found: ${sources?.length}`);

            if (sources && sources.length > 0) {
                return JSON.stringify(sources);
            }

            // 2. Fallback: Live Discovery if DB is empty
            console.log(`[get_meta_account_overview] Fallback to Live Discovery...`);
            const tokens = await getUserMetaTokens(userId);
            const accounts = await getMetaAdAccounts(tokens.accessToken);
            console.log(`[get_meta_account_overview] Live discovery found: ${accounts.length}`);

            if (accounts.length === 0) {
                return "No connected Meta Ads accounts found in database or via live discovery.";
            }

            return JSON.stringify(accounts);
        } catch (error: any) {
            return `Error fetching Meta accounts: ${error.message}`;
        }
    },
    {
        name: 'get_meta_account_overview',
        description: 'Get a list of all connected Meta (Facebook) Ads accounts for the user.',
        schema: z.object({})
    }
);

export const get_meta_performance_data = tool(
    async ({ accountId, metrics, startDate, endDate, groupBy }, config) => {
        const userId = config.configurable?.userId;
        if (userId === undefined || userId === null) return "Error: User ID not found in configuration.";

        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: {
                    userId: Number(userId),
                    sourceType: 'meta-ads',
                    accountId: accountId
                }
            });

            if (!source) return `Meta account ${accountId} not found in database. Please call get_meta_account_overview to verify your connected accounts.`;

            // Check if any historical data exists for this source
            const dataCount = await (prisma as any).metaCampaignMetrics.count({
                where: { dataSourceId: source.id }
            });

            if (dataCount === 0) {
                return JSON.stringify({
                    error: "NO_HISTORICAL_DATA",
                    message: "No historical data has been synced for this Meta account yet. Use get_live_meta_ads_data to fetch real-time data directly from Meta API instead.",
                    accountId: accountId,
                    accountName: source.accountName,
                    suggestion: "Call get_live_meta_ads_data with the same parameters to get live data."
                });
            }

            const baseMetrics = new Set<string>();
            const derivedMetrics = new Set<string>();

            metrics.forEach((m: string) => {
                if (['impressions', 'clicks', 'spend', 'reach', 'conversions', 'conversionValue'].includes(m)) {
                    baseMetrics.add(m);
                } else {
                    derivedMetrics.add(m);
                    if (m === 'ctr') { baseMetrics.add('clicks'); baseMetrics.add('impressions'); }
                    if (m === 'cpc') { baseMetrics.add('spend'); baseMetrics.add('clicks'); }
                    if (m === 'cpm') { baseMetrics.add('spend'); baseMetrics.add('impressions'); }
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
                rawResults = await (prisma as any).metaCampaignMetrics.groupBy({
                    by: ['campaignName'],
                    where: queryWhere,
                    _sum: selectMetrics
                });
            } else if (groupBy === 'date') {
                rawResults = await (prisma as any).metaCampaignMetrics.groupBy({
                    by: ['date'],
                    where: queryWhere,
                    _sum: selectMetrics
                });
            } else {
                rawResults = await (prisma as any).metaCampaignMetrics.aggregate({
                    where: queryWhere,
                    _sum: selectMetrics
                });
                rawResults = [{ _sum: rawResults._sum }];
            }

            const finalResults = rawResults.map((item: any) => {
                const data = item._sum;
                const enriched = { ...item, ...data };
                delete enriched._sum;

                if (derivedMetrics.has('ctr')) {
                    enriched.ctr = data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) + '%' : '0.00%';
                }
                if (derivedMetrics.has('cpc')) {
                    enriched.cpc = data.clicks > 0 ? (data.spend / data.clicks).toFixed(2) : '0.00';
                }
                if (derivedMetrics.has('cpm')) {
                    enriched.cpm = data.impressions > 0 ? ((data.spend / data.impressions) * 1000).toFixed(2) : '0.00';
                }

                if (baseMetrics.has('spend')) enriched.spend = data.spend?.toFixed(2);
                if (baseMetrics.has('conversionValue')) enriched.conversionValue = data.conversionValue?.toFixed(2);

                return enriched;
            });

            return JSON.stringify(finalResults);
        } catch (error: any) {
            return `Error fetching Meta performance data: ${error.message}`;
        }
    },
    {
        name: 'get_meta_performance_data',
        description: 'Fetch historical Meta Ads performance data from the database.',
        schema: z.object({
            accountId: z.string().describe('The Meta Ad Account ID (format: act_XXXXXXXXX).'),
            metrics: z.array(z.string()).describe('The metrics to fetch.'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            groupBy: z.enum(['campaign', 'date']).optional()
        })
    }
);

export const get_live_meta_ads_data = tool(
    async ({ accountId, metrics, startDate, endDate, level = 'campaign', breakdowns = [] }, config) => {
        const userId = config.configurable?.userId;
        console.log(`[get_live_meta_ads_data] Called with userId: ${userId}, accountId: ${accountId}, breakdowns: ${breakdowns}`);

        if (!userId) return "Error: User ID not found in configuration.";
        try {
            const tokens = await getUserMetaTokens(userId);
            console.log(`[get_live_meta_ads_data] Tokens retrieved`);

            const fields = ['campaign_name', 'impressions', 'clicks', 'spend', 'reach', 'frequency', 'unique_clicks', 'inline_link_clicks', 'actions', 'action_values'];
            // If breakdowns are requested, we might get multiple rows per campaign/adset
            // Dimensions will be returned in the response (e.g., 'age', 'gender')

            const insights = await getMetaInsights(tokens.accessToken, {
                accountId,
                level,
                timeRange: { since: startDate, until: endDate },
                fields,
                breakdowns: breakdowns
            });

            console.log(`[get_live_meta_ads_data] Retrieved ${insights.length} rows`);

            const results = insights.map((row: any) => {
                const item: any = {
                    campaignName: row.campaign_name || 'N/A',
                    impressions: parseInt(row.impressions || 0),
                    clicks: parseInt(row.clicks || 0),
                    uniqueClicks: parseInt(row.unique_clicks || 0),
                    linkClicks: parseInt(row.inline_link_clicks || 0),
                    spend: parseFloat(row.spend || 0).toFixed(2),
                    reach: parseInt(row.reach || 0),
                    frequency: parseFloat(row.frequency || 0).toFixed(2),
                    ...row // Include raw breakdown fields (age, gender, etc.)
                };

                // Extract conversions from actions array
                if (row.actions) {
                    const conversionAction = row.actions.find((a: any) =>
                        a.action_type === 'purchase' ||
                        a.action_type === 'offsite_conversion.fb_pixel_purchase'
                    );
                    item.conversions = conversionAction ? parseInt(conversionAction.value) : 0;
                }

                // Extract conversion value (Revenue)
                if (row.action_values) {
                    const conversionValueAction = row.action_values.find((a: any) =>
                        a.action_type === 'purchase' ||
                        a.action_type === 'offsite_conversion.fb_pixel_purchase'
                    );
                    item.conversionValue = conversionValueAction ? parseFloat(conversionValueAction.value).toFixed(2) : '0.00';
                }

                // Calculate derived metrics
                item.ctr = item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) + '%' : '0.00%';
                item.cpc = item.clicks > 0 ? (parseFloat(item.spend) / item.clicks).toFixed(2) : '0.00';
                item.cpm = item.impressions > 0 ? ((parseFloat(item.spend) / item.impressions) * 1000).toFixed(2) : '0.00';
                item.costPerUniqueClick = item.uniqueClicks > 0 ? (parseFloat(item.spend) / item.uniqueClicks).toFixed(2) : '0.00';

                // Calculate ROAS
                if (item.conversionValue && parseFloat(item.spend) > 0) {
                    item.roas = (parseFloat(item.conversionValue) / parseFloat(item.spend)).toFixed(2);
                }

                // Calculate CPP (Cost Per Purchase)
                if (item.conversions && item.conversions > 0) {
                    item.cpp = (parseFloat(item.spend) / item.conversions).toFixed(2);
                } else {
                    item.cpp = '0.00';
                }

                return item;
            });

            console.log(`[get_live_meta_ads_data] Returning ${results.length} results`);
            return JSON.stringify(results);
        } catch (error: any) {
            console.error(`[get_live_meta_ads_data] ERROR:`, error);
            return JSON.stringify({
                error: "LIVE_DATA_FETCH_FAILED",
                message: `Failed to fetch live data from Meta API: ${error.message}`,
                details: error.toString()
            });
        }
    },
    {
        name: 'get_live_meta_ads_data',
        description: 'Fetch real-time performance data directly from Meta Ads API with optional demographic and platform breakdowns. Use publisher_platform breakdown to analyze performance across Facebook, Instagram, Messenger, and Audience Network. Use impression_device to compare mobile vs desktop performance.',
        schema: z.object({
            accountId: z.string().describe('The Meta Ad Account ID (format: act_XXXXXXXXX).'),
            metrics: z.array(z.string()).describe('The metrics to fetch (e.g. impressions, clicks, spend, conversions).').optional(),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            level: z.enum(['account', 'campaign', 'adset', 'ad']).optional(),
            breakdowns: z.array(z.enum(['age', 'gender', 'country', 'region', 'impression_device', 'publisher_platform'])).optional().describe('Optional: Break down data by age, gender, etc. Note: Some combinations are not allowed.')
        })
    }
);

export const get_meta_granular_analytics = tool(
    async ({ accountId, dimension, startDate, endDate }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserMetaTokens(userId);

            let breakdowns: string[] = [];
            switch (dimension) {
                case 'age_gender':
                    breakdowns = ['age', 'gender'];
                    break;
                case 'geography':
                    breakdowns = ['country'];
                    break;
                case 'device':
                    breakdowns = ['device_platform'];
                    break;
                default:
                    breakdowns = [];
            }

            const fields = ['campaign_name', 'impressions', 'clicks', 'spend', 'reach'];

            const insights = await getMetaInsights(tokens.accessToken, {
                accountId,
                level: 'campaign',
                timeRange: { since: startDate, until: endDate },
                fields,
                breakdowns
            });

            const results = insights.map((row: any) => ({
                campaign: { name: row.campaign_name },
                metrics: {
                    impressions: parseInt(row.impressions || 0),
                    clicks: parseInt(row.clicks || 0),
                    spend: parseFloat(row.spend || 0).toFixed(2),
                    reach: parseInt(row.reach || 0)
                },
                dimensionData: {
                    age: row.age,
                    gender: row.gender,
                    country: row.country,
                    device: row.device_platform
                }
            }));

            return JSON.stringify(results);
        } catch (error: any) {
            return `Error fetching Meta granular analytics: ${error.message}`;
        }
    },
    {
        name: 'get_meta_granular_analytics',
        description: 'Fetch detailed Meta Ads analytics segmented by demographic or placement dimensions.',
        schema: z.object({
            accountId: z.string(),
            dimension: z.enum(['age_gender', 'geography', 'device']),
            startDate: z.string(),
            endDate: z.string()
        })
    }
);

// ============= MANAGEMENT TOOLS =============

export const toggle_meta_entity_status = tool(
    async ({ objectId, status }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserMetaTokens(userId);
            // Dynamic import to avoid circular dependencies if any (though usually fine here)
            const { toggleEntityStatus } = await import('@/lib/meta-ads');

            const result = await toggleEntityStatus(tokens.accessToken, objectId, status);
            return JSON.stringify({
                status: 'success',
                message: `Status for ${objectId} updated to ${status}.`,
                details: result
            });
        } catch (error: any) {
            return `Error updating status: ${error.message}`;
        }
    },
    {
        name: 'toggle_meta_entity_status',
        description: 'Pause, Activate, or Archive a Meta Campaign, Ad Set, or Ad.',
        schema: z.object({
            objectId: z.string().describe('ID of the Campaign, Ad Set, or Ad'),
            status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED'])
        })
    }
);

export const update_meta_entity_budget = tool(
    async ({ objectId, budgetType, amount }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserMetaTokens(userId);
            const { updateEntityBudget } = await import('@/lib/meta-ads');

            const result = await updateEntityBudget(tokens.accessToken, objectId, budgetType, amount);
            return JSON.stringify({
                status: 'success',
                message: `${budgetType} for ${objectId} updated to ${amount}.`,
                details: result
            });
        } catch (error: any) {
            return `Error updating budget: ${error.message}`;
        }
    },
    {
        name: 'update_meta_entity_budget',
        description: 'Update the daily or lifetime budget for a Campaign or Ad Set.',
        schema: z.object({
            objectId: z.string().describe('ID of the Campaign or Ad Set'),
            budgetType: z.enum(['daily_budget', 'lifetime_budget']),
            amount: z.number().describe('New budget amount (e.g., 50.00)')
        })
    }
);

export const create_meta_campaign = tool(
    async ({ accountId, name, objective, status, special_ad_categories }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserMetaTokens(userId);
            const { createMetaCampaign } = await import('@/lib/meta-ads');

            // Default to empty array if not provided (NONE category)
            const categories = special_ad_categories || [];

            const result = await createMetaCampaign(tokens.accessToken, accountId, {
                name,
                objective,
                status,
                special_ad_categories: categories
            });

            return JSON.stringify({
                status: 'success',
                message: `Campaign '${name}' created successfully.`,
                campaignId: result.id,
                details: result
            });
        } catch (error: any) {
            return `Error creating campaign: ${error.message}`;
        }
    },
    {
        name: 'create_meta_campaign',
        description: 'Create a new Meta Ads Campaign.',
        schema: z.object({
            accountId: z.string().describe('Ad Account ID'),
            name: z.string(),
            objective: z.enum(['OUTCOME_TRAFFIC', 'OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS', 'OUTCOME_APP_PROMOTION']),
            status: z.enum(['ACTIVE', 'PAUSED']),
            special_ad_categories: z.array(z.string()).optional().describe('Required if ads relate to credit, employment, housing, etc.')
        })
    }
);

export const get_meta_ad_preview = tool(
    async ({ creativeId, format }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserMetaTokens(userId);
            const { getAdPreview } = await import('@/lib/meta-ads');

            const previewHtml = await getAdPreview(tokens.accessToken, creativeId, format);
            return JSON.stringify({
                status: 'success',
                previewHtml: previewHtml
            });
        } catch (error: any) {
            return `Error fetching preview: ${error.message}`;
        }
    },
    {
        name: 'get_meta_ad_preview',
        description: 'Get a preview (HTML) of an ad creative.',
        schema: z.object({
            creativeId: z.string().describe('ID of the Ad Creative (found in Ad details)'),
            format: z.enum(['DESKTOP_FEED_STANDARD', 'MOBILE_FEED_STANDARD']).optional()
        })
    }
);

export const get_meta_ad_format_performance = tool(
    async ({ accountId, startDate, endDate, campaignId }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";

        try {
            const tokens = await getUserMetaTokens(userId);
            const { getMetaAdsWithCreative } = await import('@/lib/meta-ads');

            // Helper: Split large date ranges into monthly chunks
            const chunkDateRange = (start: string, end: string): Array<{ since: string, until: string }> => {
                const startDate = new Date(start);
                const endDate = new Date(end);
                const chunks: Array<{ since: string, until: string }> = [];

                // If range is less than 60 days, return as single chunk
                const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysDiff <= 60) {
                    return [{ since: start, until: end }];
                }

                // Split into monthly chunks
                let currentStart = new Date(startDate);
                while (currentStart < endDate) {
                    const currentEnd = new Date(currentStart);
                    currentEnd.setMonth(currentEnd.getMonth() + 1);

                    // Don't exceed the final end date
                    const chunkEnd = currentEnd > endDate ? endDate : currentEnd;

                    chunks.push({
                        since: currentStart.toISOString().split('T')[0],
                        until: chunkEnd.toISOString().split('T')[0]
                    });

                    currentStart = new Date(chunkEnd);
                    currentStart.setDate(currentStart.getDate() + 1); // Move to next day
                }

                return chunks;
            };

            const dateChunks = chunkDateRange(startDate, endDate);
            console.log(`[get_meta_ad_format_performance] Split into ${dateChunks.length} date chunks`);

            // Fetch ads for all date chunks in BATCHES to avoid Rate Limits
            const BATCH_SIZE = 3;
            const DELAY_MS = 1000;
            const allAdsArrays: any[][] = [];

            console.log(`[get_meta_ad_format_performance] Fetching in batches of ${BATCH_SIZE}...`);

            for (let i = 0; i < dateChunks.length; i += BATCH_SIZE) {
                const batch = dateChunks.slice(i, i + BATCH_SIZE);
                console.log(`[get_meta_ad_format_performance] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dateChunks.length / BATCH_SIZE)}`);

                const batchResults = await Promise.all(
                    batch.map(chunk =>
                        getMetaAdsWithCreative(
                            tokens.accessToken,
                            accountId,
                            chunk.since,
                            chunk.until,
                            campaignId
                        ).catch(err => {
                            console.warn(`[get_meta_ad_format_performance] Failed chunk ${chunk.since} to ${chunk.until}:`, err.message);
                            return []; // Return empty array on error
                        })
                    )
                );

                allAdsArrays.push(...batchResults);

                // Add delay between batches (if not the last batch)
                if (i + BATCH_SIZE < dateChunks.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            }

            // Flatten all ads from all chunks

            const allAds = allAdsArrays.flat();
            console.log(`[get_meta_ad_format_performance] Retrieved ${allAds.length} total ads across all chunks`);

            // Helper function to detect ad format from creative object
            const detectFormat = (creative: any): string => {
                if (!creative) return 'Unknown';

                const spec = creative.object_story_spec;
                const assetFeed = creative.asset_feed_spec;

                // 1. Dynamic Creative (DCO)
                if (assetFeed) {
                    return 'Dynamic Creative';
                }

                if (!spec) return 'Unknown';

                // 2. Collection / Instant Experience
                // Often indicated by template_url or specific page_id links
                if (spec.template_data?.link || spec.link_data?.link?.includes('canvas_doc_id')) {
                    return 'Instant Experience';
                }
                if (creative.template_url) {
                    return 'Instant Experience';
                }

                // 3. Carousel (multiple child attachments)
                if (spec.link_data?.child_attachments || spec.template_data?.child_attachments) {
                    return 'Carousel';
                }

                // 4. Video/Reels
                if (spec.video_data || spec.link_data?.video_id) {
                    return 'Video/Reels';
                }

                // 5. Single Image
                if (spec.link_data?.image_hash || spec.link_data?.picture) {
                    return 'Single Image';
                }

                return 'Other';
            };

            // Helper function to extract creative URL for display
            const getCreativeUrl = (creative: any): string | null => {
                if (!creative) return null;
                const spec = creative.object_story_spec;

                // 1. Try to get image from Dynamic Creative (DCO)
                if (creative.asset_feed_spec?.images?.[0]?.url) {
                    return creative.asset_feed_spec.images[0].url;
                }

                // 2. Try to get thumbnail from Collection/Instant Experience
                if (creative.template_url || creative.thumbnail_url) {
                    return creative.thumbnail_url || creative.image_url;
                }

                if (!spec) return null;

                // 3. Try to get image URL (Link Data)
                if (spec.link_data?.picture) return spec.link_data.picture;
                if (spec.link_data?.image_url) return spec.link_data.image_url;

                // 4. Try to get video thumbnail
                if (spec.video_data?.picture) return spec.video_data.picture;
                if (spec.video_data?.image_url) return spec.video_data.image_url;

                // 5. Fallback for Template Data (Collection child attachments)
                if (spec.template_data?.child_attachments?.[0]?.picture) {
                    return spec.template_data.child_attachments[0].picture;
                }

                return null;
            };

            // Aggregate performance by format
            const formatStats: any = {};
            const formatCreatives: any = {}; // Store sample creatives per format
            const otherFormatDetails: any[] = []; // Store details for "Other" category analysis

            allAds.forEach((ad: any) => {
                const format = detectFormat(ad.creative);
                const insights = ad.insights?.data?.[0];

                if (!insights) return; // Skip ads without insights data

                if (!formatStats[format]) {
                    formatStats[format] = {
                        format,
                        impressions: 0,
                        clicks: 0,
                        spend: 0,
                        reach: 0,
                        conversions: 0,
                        conversionValue: 0,
                        adCount: 0
                    };
                    formatCreatives[format] = [];
                }

                const stats = formatStats[format];
                stats.impressions += parseInt(insights.impressions || 0);
                stats.clicks += parseInt(insights.clicks || 0);
                stats.spend += parseFloat(insights.spend || 0);
                stats.reach += parseInt(insights.reach || 0);
                stats.adCount += 1;

                // Store details for "Other" ads to help user understand them
                if (format === 'Other' && otherFormatDetails.length < 10) {
                    otherFormatDetails.push({
                        id: ad.id,
                        name: ad.name,
                        creativeId: ad.creative?.id,
                        creativeData: ad.creative // Include snippet for debugging
                    });
                }

                // Store sample creative (up to 3 per format)
                const creativeUrl = getCreativeUrl(ad.creative);
                if (creativeUrl && formatCreatives[format].length < 3) {
                    formatCreatives[format].push({
                        url: creativeUrl,
                        adName: ad.name,
                        format // Pass format for UI badge
                    });
                }

                // Extract conversions
                if (insights.actions) {
                    const conversionAction = insights.actions.find((a: any) =>
                        a.action_type === 'purchase' ||
                        a.action_type === 'offsite_conversion.fb_pixel_purchase'
                    );
                    if (conversionAction) {
                        stats.conversions += parseInt(conversionAction.value || 0);
                    }
                }

                // Extract conversion value
                if (insights.action_values) {
                    const valueAction = insights.action_values.find((a: any) =>
                        a.action_type === 'purchase' ||
                        a.action_type === 'offsite_conversion.fb_pixel_purchase'
                    );
                    if (valueAction) {
                        stats.conversionValue += parseFloat(valueAction.value || 0);
                    }
                }
            });

            // Calculate derived metrics and format results
            const results = Object.values(formatStats).map((stats: any) => {
                const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) + '%' : '0.00%';
                const cpc = stats.clicks > 0 ? (stats.spend / stats.clicks).toFixed(2) : '0.00';
                const cpm = stats.impressions > 0 ? ((stats.spend / stats.impressions) * 1000).toFixed(2) : '0.00';
                const roas = stats.spend > 0 ? (stats.conversionValue / stats.spend).toFixed(2) : '0.00';
                const app = stats.conversions > 0 ? (stats.spend / stats.conversions).toFixed(2) : '0.00';

                return {
                    format: stats.format,
                    adCount: stats.adCount,
                    impressions: stats.impressions.toLocaleString(),
                    clicks: stats.clicks.toLocaleString(),
                    ctr,
                    spend: '$' + stats.spend.toFixed(2),
                    cpc: '$' + cpc,
                    cpm: '$' + cpm,
                    conversions: stats.conversions,
                    conversionValue: '$' + stats.conversionValue.toFixed(2),
                    roas: roas,
                    cpp: '$' + app,
                    sampleCreatives: formatCreatives[stats.format] || []
                };
            });

            // Sort by ROAS (best performing first)
            results.sort((a, b) => parseFloat(b.roas) - parseFloat(a.roas));

            if (results.length === 0) {
                return JSON.stringify({
                    error: "NO_FORMAT_DATA",
                    message: "No ads with creative data found for the specified date range. This could mean no ads were active during this period, or creative data is not available.",
                    accountId,
                    dateRange: `${startDate} to ${endDate}`,
                    chunksProcessed: dateChunks.length
                });
            }

            return JSON.stringify({
                results,
                metadata: {
                    totalAds: allAds.length,
                    dateRange: `${startDate} to ${endDate}`,
                    chunksProcessed: dateChunks.length
                },
                // Return samples of unknown formats so the Agent can explain or debug them
                unknown_formats_samples: otherFormatDetails
            });
        } catch (error: any) {
            console.error(`[get_meta_ad_format_performance] ERROR:`, error);
            return JSON.stringify({
                error: "FORMAT_ANALYSIS_FAILED",
                message: `Failed to analyze ad formats: ${error.message}`,
                details: error.toString()
            });
        }
    },
    {
        name: 'get_meta_ad_format_performance',
        description: 'Analyze Meta Ads performance by ad format type (Carousel, Single Image, Video/Reels, Catalogue/Dynamic). Automatically handles large date ranges by splitting into monthly chunks. Returns performance metrics AND sample creative images/videos for each format. Use this to answer "which ad format performs best?" questions.',
        schema: z.object({
            accountId: z.string().describe('The Meta Ad Account ID (format: act_XXXXXXXXX).'),
            startDate: z.string().describe('YYYY-MM-DD'),
            endDate: z.string().describe('YYYY-MM-DD'),
            campaignId: z.string().optional().describe('Optional: Filter to specific campaign')
        })
    }
);

export const transfer_to_meta_ads = tool(
    async () => {
        return "Transferred to Meta Ads Specialist. You can now process Meta advertising queries.";
    },
    {
        name: 'transfer_to_meta_ads',
        description: 'Call this tool to transfer control to the Meta Ads specialist for any Meta advertising, ads, or performance data queries.',
        schema: z.object({})
    }
);

export const transfer_to_google_sheets = tool(
    async () => {
        return "Transferred to Google Sheets Specialist. You can now process spreadsheet management tasks.";
    },
    {
        name: 'transfer_to_google_sheets',
        description: 'Call this tool to transfer control to the Google Sheets specialist for creating, reading, updating, or formatting spreadsheets.',
        schema: z.object({})
    }
);

export const transfer_to_google_ads = tool(
    async () => {
        return "Transferred to Google Ads Specialist. You can now process Google Ads queries.";
    },
    {
        name: 'transfer_to_google_ads',
        description: 'Call this tool to transfer control to the Google Ads specialist for any Google advertising queries.',
        schema: z.object({})
    }
);

// Export all Meta tools as an array
export const metaTools = [
    get_meta_account_overview,
    get_meta_performance_data,
    get_live_meta_ads_data,
    get_meta_granular_analytics,
    get_meta_ad_format_performance,
    toggle_meta_entity_status,
    update_meta_entity_budget,
    create_meta_campaign,
    get_meta_ad_preview,
    transfer_to_google_sheets,
    transfer_to_google_ads
];
