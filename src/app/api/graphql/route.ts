import { NextRequest, NextResponse } from 'next/server';
import { graphql, buildSchema } from 'graphql';
import { GoogleAdsApi } from 'google-ads-api';
import prisma from '@/lib/prisma';
import { syncTodaysData } from '@/lib/sync-engine';
import { getGoogleAdsClient, getUserTokens } from '@/lib/google-ads';

// Load credentials from SyncMaster.json
import credentialsFile from '../../../../SyncMaster.json';
const credentials = credentialsFile.installed;

// GraphQL Schema for Google Ads
const schema = buildSchema(`
  type Campaign {
    id: ID!
    name: String!
    status: String!
    impressions: Int
    clicks: Int
    cost: Float
    cpc: Float
    ctr: Float
    conversions: Int
    conversionValue: Float
  }

  type AdGroup {
    id: ID!
    name: String!
    campaignId: ID!
    status: String!
    impressions: Int
    clicks: Int
    cost: Float
    cpc: Float
    ctr: Float
    conversions: Int
  }

  type Ad {
    id: ID!
    headline: String!
    description: String!
    status: String!
    impressions: Int
    clicks: Int
    cost: Float
    ctr: Float
  }

  type Keyword {
    id: ID!
    text: String!
    matchType: String!
    status: String!
    impressions: Int
    clicks: Int
    cost: Float
    cpc: Float
    conversions: Int
  }

  type Account {
    id: ID!
    name: String!
    currency: String
    timeZone: String
    impressions: Int
    clicks: Int
    cost: Float
    conversions: Int
    conversionValue: Float
  }

  input DateRangeInput {
    startDate: String!
    endDate: String!
  }

  type HourlyMetric {
    hour: Int!
    impressions: Int
    clicks: Int
    cost: Float
    conversions: Int
    conversionValue: Float
  }

  type DemographicMetric {
    label: String!
    impressions: Int
    clicks: Int
    cost: Float
    conversions: Int
    conversionValue: Float
    cvr: Float
    costPerConv: Float
  }

  type LocationMetric {
    region: String
    city: String
    postalCode: String
    impressions: Int
    clicks: Int
    cost: Float
    conversions: Int
    conversionValue: Float
  }

  type Query {
    campaigns(accountId: ID!, dateRange: DateRangeInput): [Campaign!]!
    hourlyPerformance(accountId: ID!, dateRange: DateRangeInput): [HourlyMetric!]!
    demographics(accountId: ID!, type: String!, dateRange: DateRangeInput): [DemographicMetric!]!
    devicePerformance(accountId: ID!, dateRange: DateRangeInput): [DemographicMetric!]!
    geographicPerformance(accountId: ID!, dateRange: DateRangeInput): [LocationMetric!]!
    adGroups(accountId: ID!, campaignId: ID, dateRange: DateRangeInput): [AdGroup!]!
    ads(accountId: ID!, adGroupId: ID, dateRange: DateRangeInput): [Ad!]!
    keywords(accountId: ID!, adGroupId: ID, dateRange: DateRangeInput): [Keyword!]!
    account(accountId: ID!, dateRange: DateRangeInput): Account
    accounts(userId: ID!): [Account!]!
  }

  type Mutation {
    updateCampaign(accountId: ID!, campaignId: ID!, status: String!): Campaign
    updateAdGroup(accountId: ID!, adGroupId: ID!, status: String!): AdGroup
    updateAd(accountId: ID!, adId: ID!, status: String!): Ad
  }
`);

// Root resolver
const root = {
    campaigns: async ({ accountId, dateRange }: any, context: any) => {
        try {
            // 1. Get Source ID for DB queries
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });

            if (!source) {
                // Fallback if source not found in DB but exists in session? Unlikely.
                // Retain old logic? No, this is new architecture. Error out or fallback.
                // Just return empty array to prevent crash.
                return [];
            }

            // 2. Read-Through Sync Logic
            const todayStr = new Date().toISOString().split('T')[0];
            let needsSync = false;

            if (dateRange) {
                if (dateRange.endDate >= todayStr) needsSync = true;
            } else {
                needsSync = true; // Default to fresh if no range
            }

            if (needsSync) {
                // Determine managerId from source (stored in DB)
                // We must import syncTodaysData at top of file, or dynamic import.
                // Assuming static import added (I will add it).
                await syncTodaysData(parseInt(context.userId), source.id, accountId, source.managerId);
            }

            // 3. Query DB Aggegated
            const where: any = { dataSourceId: source.id };
            if (dateRange) {
                where.date = {
                    gte: new Date(dateRange.startDate),
                    lte: new Date(dateRange.endDate)
                };
            }

            const metrics = await (prisma as any).campaignMetrics.groupBy({
                by: ['campaignId', 'campaignName', 'status'],
                where: where,
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true,
                    conversionValue: true
                }
            });

            // 4. Transform & Calculate Derived Metrics
            // Group by campaignId to merge multiple status entries if ID is same?
            // Actually, if status changed, we might have 2 rows for same campaign (one ENABLED, one PAUSED).
            // We want 'Latest Status' or just aggregate them.
            // Simplified: Map distinct ID using a Map.

            const merged = new Map();

            metrics.forEach((m: any) => {
                const id = m.campaignId;
                if (!merged.has(id)) {
                    merged.set(id, {
                        id: id,
                        name: m.campaignName,
                        status: m.status, // Take first status encountered (or sort by date desc if we could).
                        // groupBy doesn't allow sort by date.
                        // Logic trade-off: Status might be ambiguous if changed mid-range.
                        // Acceptable for analytics summary.
                        impressions: 0,
                        clicks: 0,
                        cost: 0,
                        conversions: 0,
                        conversionValue: 0
                    });
                }
                const entry = merged.get(id);
                entry.impressions += m._sum.impressions || 0;
                entry.clicks += m._sum.clicks || 0;
                entry.cost += m._sum.cost || 0;
                entry.conversions += m._sum.conversions || 0;
                entry.conversionValue += m._sum.conversionValue || 0;
                // Update status to latest? We don't know date here.
                // Just keep first found.
            });

            return Array.from(merged.values()).map((c: any) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                impressions: c.impressions,
                clicks: c.clicks,
                cost: c.cost,
                cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
                ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
                conversions: c.conversions,
                conversionValue: c.conversionValue,
            }));

        } catch (error) {
            console.error('GraphQL campaigns error:', error);
            throw new Error('Failed to fetch campaigns');
        }
    },

    hourlyPerformance: async ({ accountId, dateRange }: any, context: any) => {
        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            if (!source) return [];

            const todayStr = new Date().toISOString().split('T')[0];
            let needsSync = !dateRange || dateRange.endDate >= todayStr;
            if (needsSync) {
                await syncTodaysData(parseInt(context.userId), source.id, accountId, source.managerId);
            }

            const where: any = { dataSourceId: source.id };
            if (dateRange) {
                where.date = {
                    gte: new Date(dateRange.startDate),
                    lte: new Date(dateRange.endDate)
                };
            }

            const metrics = await (prisma as any).campaignMetrics.groupBy({
                by: ['hour'],
                where: where,
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true,
                    conversionValue: true
                },
                orderBy: {
                    hour: 'asc'
                }
            });

            return metrics.map((m: any) => ({
                hour: m.hour,
                impressions: m._sum.impressions || 0,
                clicks: m._sum.clicks || 0,
                cost: m._sum.cost || 0,
                conversions: m._sum.conversions || 0,
                conversionValue: m._sum.conversionValue || 0
            }));
        } catch (error) {
            console.error('GraphQL hourlyPerformance error:', error);
            throw new Error('Failed to fetch hourly performance');
        }
    },

    demographics: async ({ accountId, type, dateRange }: any, context: any) => {
        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            if (!source) return [];

            const where: any = { dataSourceId: source.id };
            if (dateRange) {
                where.date = { gte: new Date(dateRange.startDate), lte: new Date(dateRange.endDate) };
            }

            let metrics: any[] = [];
            const modelName = type.toLowerCase() === 'gender' ? 'genderMetrics' :
                type.toLowerCase() === 'age' ? 'ageRangeMetrics' : 'incomeRangeMetrics';
            const byField = type.toLowerCase() === 'gender' ? 'gender' :
                type.toLowerCase() === 'age' ? 'ageRange' : 'incomeRange';

            const model = (prisma as any)[modelName];
            if (!model) {
                console.error(`Prisma model "${modelName}" is undefined. Retrying with capitalized...`);
                const altName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
                const retryModel = (prisma as any)[altName];
                if (!retryModel) throw new Error(`Prisma model "${modelName}" not found on client.`);
                metrics = await retryModel.groupBy({
                    by: [byField],
                    where: where,
                    _sum: { impressions: true, clicks: true, cost: true, conversions: true, conversionValue: true }
                });
            } else {
                metrics = await model.groupBy({
                    by: [byField],
                    where: where,
                    _sum: { impressions: true, clicks: true, cost: true, conversions: true, conversionValue: true }
                });
            }

            return metrics.map((m: any) => ({
                label: m[byField],
                impressions: m._sum.impressions || 0,
                clicks: m._sum.clicks || 0,
                cost: m._sum.cost || 0,
                conversions: m._sum.conversions || 0,
                conversionValue: m._sum.conversionValue || 0,
                cvr: m._sum.clicks > 0 ? (m._sum.conversions / m._sum.clicks) * 100 : 0,
                costPerConv: m._sum.conversions > 0 ? m._sum.cost / m._sum.conversions : m._sum.cost
            }));
        } catch (error) {
            console.error(`GraphQL demographics error (${type}):`, error);
            throw new Error('Failed to fetch demographic performance');
        }
    },

    devicePerformance: async ({ accountId, dateRange }: any, context: any) => {
        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            if (!source) return [];

            const where: any = { dataSourceId: source.id };
            if (dateRange) {
                where.date = { gte: new Date(dateRange.startDate), lte: new Date(dateRange.endDate) };
            }

            const model = (prisma as any).deviceMetrics || (prisma as any).DeviceMetrics;
            if (!model) throw new Error('Prisma model "deviceMetrics" not found on client.');

            const metrics = await model.groupBy({
                by: ['device'],
                where: where,
                _sum: { impressions: true, clicks: true, cost: true, conversions: true, conversionValue: true }
            });

            return metrics.map((m: any) => ({
                label: m.device,
                impressions: m._sum.impressions || 0,
                clicks: m._sum.clicks || 0,
                cost: m._sum.cost || 0,
                conversions: m._sum.conversions || 0,
                conversionValue: m._sum.conversionValue || 0,
                cvr: m._sum.clicks > 0 ? (m._sum.conversions / m._sum.clicks) * 100 : 0,
                costPerConv: m._sum.conversions > 0 ? m._sum.cost / m._sum.conversions : m._sum.cost
            }));
        } catch (error) {
            console.error('GraphQL devicePerformance error:', error);
            throw new Error('Failed to fetch device performance');
        }
    },

    geographicPerformance: async ({ accountId, dateRange }: any, context: any) => {
        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            if (!source) return [];

            const where: any = { dataSourceId: source.id };
            if (dateRange) {
                where.date = { gte: new Date(dateRange.startDate), lte: new Date(dateRange.endDate) };
            }

            const model = (prisma as any).locationMetrics || (prisma as any).LocationMetrics;
            if (!model) {
                const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
                throw new Error(`Prisma model "locationMetrics" not found. Available: ${keys.join(', ')}`);
            }

            const metrics = await model.groupBy({
                by: ['region', 'city', 'postalCode'],
                where: where,
                _sum: { impressions: true, clicks: true, cost: true, conversions: true, conversionValue: true }
            });

            return metrics.map((m: any) => ({
                region: m.region,
                city: m.city,
                postalCode: m.postalCode,
                impressions: m._sum.impressions || 0,
                clicks: m._sum.clicks || 0,
                cost: m._sum.cost || 0,
                conversions: m._sum.conversions || 0,
                conversionValue: m._sum.conversionValue || 0
            }));
        } catch (error) {
            console.error('GraphQL geographicPerformance error:', error);
            throw new Error('Failed to fetch geographic performance');
        }
    },

    adGroups: async ({ accountId, campaignId, dateRange }: any, context: any) => {
        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            if (!source) return [];

            const todayStr = new Date().toISOString().split('T')[0];
            let needsSync = !dateRange || dateRange.endDate >= todayStr;

            if (needsSync) {
                await syncTodaysData(parseInt(context.userId), source.id, accountId, source.managerId);
            }

            const where: any = { dataSourceId: source.id };
            if (dateRange) {
                where.date = { gte: new Date(dateRange.startDate), lte: new Date(dateRange.endDate) };
            }
            if (campaignId) {
                where.campaignId = campaignId;
            }

            const metrics = await (prisma as any).adGroupMetrics.groupBy({
                by: ['adGroupId', 'adGroupName', 'campaignId', 'status'],
                where: where,
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true,
                    conversionValue: true
                }
            });

            const merged = new Map();
            metrics.forEach((m: any) => {
                const id = m.adGroupId;
                if (!merged.has(id)) {
                    merged.set(id, {
                        id: id,
                        name: m.adGroupName,
                        campaignId: m.campaignId,
                        status: m.status,
                        impressions: 0, clicks: 0, cost: 0, conversions: 0
                    });
                }
                const entry = merged.get(id);
                entry.impressions += m._sum.impressions || 0;
                entry.clicks += m._sum.clicks || 0;
                entry.cost += m._sum.cost || 0;
                entry.conversions += m._sum.conversions || 0;
            });

            return Array.from(merged.values()).map((ag: any) => ({
                id: ag.id,
                name: ag.name,
                campaignId: ag.campaignId,
                status: ag.status,
                impressions: ag.impressions,
                clicks: ag.clicks,
                cost: ag.cost,
                cpc: ag.clicks > 0 ? ag.cost / ag.clicks : 0,
                ctr: ag.impressions > 0 ? (ag.clicks / ag.impressions) * 100 : 0,
                conversions: ag.conversions,
            }));
        } catch (error) {
            console.error('GraphQL adGroups error:', error);
            throw new Error('Failed to fetch ad groups');
        }
    },

    ads: async ({ accountId, adGroupId, dateRange }: any, context: any) => {
        try {
            const client = await getGoogleAdsClient();

            // Get managerId for this source
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            const loginId = source?.managerId || accountId;

            const customer = client.Customer({
                customer_id: accountId.replace(/-/g, ''),
                login_customer_id: loginId.replace(/-/g, ''),
                access_token: context.accessToken,
                refresh_token: context.refreshToken,
            } as any);

            let query = `
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.headline_part_1,
          ad_group_ad.ad.description,
          ad_group_ad.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr
        FROM ad_group_ad
        WHERE ad_group_ad.status IN ('ENABLED', 'PAUSED')
      `;

            if (adGroupId) {
                query += ` AND ad_group_ad.ad_group = '${adGroupId}'`;
            }

            if (dateRange) {
                query += ` AND segments.date >= '${dateRange.startDate}' AND segments.date <= '${dateRange.endDate}'`;
            }

            const result = await customer.query(query);

            return result.map((ad: any) => ({
                id: ad.ad_group_ad.ad.id.toString(),
                headline: ad.ad_group_ad.ad.headline_part_1 || 'No headline',
                description: ad.ad_group_ad.ad.description || 'No description',
                status: ad.ad_group_ad.status,
                impressions: parseInt(ad.metrics?.impressions || 0),
                clicks: parseInt(ad.metrics?.clicks || 0),
                cost: parseFloat(ad.metrics?.cost_micros || 0) / 1000000,
                ctr: parseFloat(ad.metrics?.ctr || 0) * 100,
            }));
        } catch (error) {
            console.error('GraphQL ads error:', error);
            throw new Error('Failed to fetch ads');
        }
    },

    keywords: async ({ accountId, adGroupId, dateRange }: any, context: any) => {
        try {
            const client = await getGoogleAdsClient();

            // Get managerId for this source
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            const loginId = source?.managerId || accountId;

            const customer = client.Customer({
                customer_id: accountId.replace(/-/g, ''),
                login_customer_id: loginId.replace(/-/g, ''),
                access_token: context.accessToken,
                refresh_token: context.refreshToken,
            } as any);

            let query = `
        SELECT
          keyword_view.resource_name,
          keyword_view.text,
          keyword_view.match_type,
          keyword_view.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.average_cpc,
          metrics.conversions
        FROM keyword_view
        WHERE keyword_view.status IN ('ENABLED', 'PAUSED')
      `;

            if (adGroupId) {
                query += ` AND keyword_view.ad_group = '${adGroupId}'`;
            }

            if (dateRange) {
                query += ` AND segments.date >= '${dateRange.startDate}' AND segments.date <= '${dateRange.endDate}'`;
            }

            const result = await customer.query(query);

            return result.map((keyword: any) => ({
                id: keyword.keyword_view.resource_name,
                text: keyword.keyword_view.text,
                matchType: keyword.keyword_view.match_type,
                status: keyword.keyword_view.status,
                impressions: parseInt(keyword.metrics?.impressions || 0),
                clicks: parseInt(keyword.metrics?.clicks || 0),
                cost: parseFloat(keyword.metrics?.cost_micros || 0) / 1000000,
                cpc: parseFloat(keyword.metrics?.average_cpc || 0) / 1000000,
                conversions: parseInt(keyword.metrics?.conversions || 0),
            }));
        } catch (error) {
            console.error('GraphQL keywords error:', error);
            throw new Error('Failed to fetch keywords');
        }
    },

    account: async ({ accountId, dateRange }: any, context: any) => {
        try {
            const source = await (prisma as any).dataSource.findFirst({
                where: { userId: parseInt(context.userId), accountId: accountId }
            });
            if (!source) return null;

            // Sync Today if needed
            const todayStr = new Date().toISOString().split('T')[0];
            let needsSync = !dateRange || dateRange.endDate >= todayStr;
            if (needsSync) {
                await syncTodaysData(parseInt(context.userId), source.id, accountId, source.managerId);
            }

            const where: any = { dataSourceId: source.id };
            if (dateRange) {
                where.date = { gte: new Date(dateRange.startDate), lte: new Date(dateRange.endDate) };
            }

            const agg = await (prisma as any).campaignMetrics.aggregate({
                where: where,
                _sum: {
                    impressions: true,
                    clicks: true,
                    cost: true,
                    conversions: true,
                    conversionValue: true
                }
            });

            return {
                id: source.accountId,
                name: source.accountName,
                currency: source.currency || 'USD',
                timeZone: 'America/New_York', // We should store this in DataSource too eventually
                impressions: agg._sum.impressions || 0,
                clicks: agg._sum.clicks || 0,
                cost: agg._sum.cost || 0,
                conversions: agg._sum.conversions || 0,
                conversionValue: agg._sum.conversionValue || 0,
            };
        } catch (error: any) {
            console.error('GraphQL account error:', error);
            throw new Error(`Failed to fetch account: ${error.message}`);
        }
    },

    accounts: async ({ userId }: any) => {
        try {
            const dataSources = await (prisma as any).dataSource.findMany({
                where: {
                    userId: parseInt(userId),
                    sourceType: 'google-ads',
                    status: 'active'
                }
            });

            // Parallel Aggregation
            const accountsData = await Promise.all(dataSources.map(async (source: any) => {
                // For Main Dashboard, usually we show "Last 30 Days" or "All Time"?
                // Let's assume All Time aggregated from what we have, or Last 30 Days default?
                // Use last 30 days for relevance.
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);

                const agg = await (prisma as any).campaignMetrics.aggregate({
                    where: {
                        dataSourceId: source.id,
                        date: { gte: startDate, lte: endDate }
                    },
                    _sum: {
                        impressions: true,
                        clicks: true,
                        cost: true,
                        conversions: true,
                        conversionValue: true
                    }
                });

                return {
                    id: source.accountId,
                    name: source.accountName,
                    currency: source.currency || 'USD',
                    timeZone: 'America/New_York',
                    impressions: agg._sum.impressions || 0,
                    clicks: agg._sum.clicks || 0,
                    cost: agg._sum.cost || 0,
                    conversions: agg._sum.conversions || 0,
                    conversionValue: agg._sum.conversionValue || 0,
                };
            }));

            return accountsData;
        } catch (error) {
            console.error('GraphQL accounts error:', error);
            throw new Error('Failed to fetch accounts');
        }
    },
};


export async function POST(request: NextRequest) {
    try {
        const { query, variables, userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 401 });
        }

        // Get user tokens for authentication
        const tokens = await getUserTokens(userId);

        // Create context with user data
        const context = {
            userId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };

        const result = await graphql({
            schema,
            source: query,
            rootValue: root,
            contextValue: context,
            variableValues: variables,
        });

        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            return NextResponse.json({ errors: result.errors }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('GraphQL API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
