import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, MemorySaver, Annotation, Send } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getGoogleAdsClient, getUserTokens } from '@/lib/google-ads';

// ============= STATE DEFINITION =============

const RootState = Annotation.Root({
    ...MessagesAnnotation.spec,
    next: Annotation<string>({
        reducer: (a, b) => b ?? a,
        default: () => "FINISH"
    }),
    reasoning: Annotation<string>({
        reducer: (a, b) => b ?? a,
        default: () => ""
    }),
    accountId: Annotation<string>({
        reducer: (a, b) => b ?? a,
        default: () => ""
    }),
    spreadsheetId: Annotation<string>({
        reducer: (a, b) => b ?? a,
        default: () => ""
    })
});

// ============= TOOLS (NEVER REMOVE) =============
// 1. Define Google Ads Tools
const get_account_overview = tool(
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
            const client = await getGoogleAdsClient();
            const tokens = await getUserTokens(userId);
            console.log(`[get_account_overview] Tokens retrieved: ${!!tokens}`);

            // listAccessibleCustomers only needs accessToken
            const response = await client.listAccessibleCustomers(tokens.accessToken);
            console.log(`[get_account_overview] accessibleCustomers response:`, JSON.stringify(response));

            const resourceNames = (response as any).resource_names || (Array.isArray(response) ? response : []);

            const discoveredAccounts = [];
            for (const resourceName of resourceNames) {
                const cleanId = resourceName.split('/')[1];
                discoveredAccounts.push({
                    accountId: cleanId,
                    accountName: `Account ${cleanId}`,
                    currency: '---'
                });
            }

            console.log(`[get_account_overview] Live discovery found: ${discoveredAccounts.length}`);
            if (discoveredAccounts.length === 0) {
                return "No connected Google Ads accounts found in database or via live discovery.";
            }

            return JSON.stringify(discoveredAccounts);
        } catch (error: any) {
            return `Error fetching accounts: ${error.message}`;
        }
    },
    {
        name: 'get_account_overview',
        description: 'Get a list of all connected Google Ads accounts for the user.',
        schema: z.object({})
    }
);

const get_performance_data = tool(
    async ({ accountId, metrics, startDate, endDate, groupBy }, config) => {
        const userId = config.configurable?.userId;
        if (userId === undefined || userId === null) return "Error: User ID not found in configuration.";

        try {
            // Flexible account matching (handle hyphens)
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

            // Check if any historical data exists for this source
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

const get_live_google_ads_data = tool(
    async ({ accountId, metrics, startDate, endDate, groupBy, entity = 'campaign', fetchStructuredData = false }, config) => {
        const userId = config.configurable?.userId;
        console.log(`[get_live_google_ads_data] Called with userId: ${userId}, accountId: ${accountId}`);

        if (!userId) return "Error: User ID not found in configuration.";
        try {
            console.log(`[get_live_google_ads_data] Getting Google Ads client...`);
            const client = await getGoogleAdsClient();

            console.log(`[get_live_google_ads_data] Getting user tokens for userId: ${userId}`);
            const tokens = await getUserTokens(userId);
            console.log(`[get_live_google_ads_data] Tokens retrieved: ${!!tokens}, refreshToken exists: ${!!tokens?.refreshToken}`);

            const customerId = accountId.replace(/-/g, '');
            console.log(`[get_live_google_ads_data] Customer ID: ${customerId}`);

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
            console.log(`[get_live_google_ads_data] Source found: ${!!source}, managerId: ${source?.managerId}`);

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
            // ALWAYS add segments.date when using date range filter (Google Ads API requirement)
            fields.add('segments.date');
            const gaql = `SELECT ${Array.from(fields).join(', ')} FROM ${fromTable} WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' ORDER BY segments.date DESC LIMIT 50`;

            console.log(`[get_live_google_ads_data] GAQL Query: ${gaql}`);
            console.log(`[get_live_google_ads_data] Executing query...`);

            const rows = await customer.query(gaql);
            console.log(`[get_live_google_ads_data] Query returned ${rows?.length || 0} rows`);

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

            console.log(`[get_live_google_ads_data] Returning ${results.length} results`);
            return JSON.stringify(results);
        } catch (error: any) {
            console.error(`[get_live_google_ads_data] ERROR:`, error);
            console.error(`[get_live_google_ads_data] Error stack:`, error.stack);
            return JSON.stringify({
                error: "LIVE_DATA_FETCH_FAILED",
                message: `Failed to fetch live data from Google Ads API: ${error.message}`,
                details: error.toString()
            });
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

const get_granular_analytics = tool(
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





import { getGoogleOAuth2Client, createGoogleSheet, appendValues, updateValues, readValues, batchUpdateSheet, searchSpreadsheets, deleteSpreadsheet, renameSpreadsheet, deleteDimensions } from '@/lib/google-sheets';

// 4. Define Google Sheets Tools
const create_google_sheet = tool(
    async ({ title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            const result = await createGoogleSheet(oauth2Client, title);
            return JSON.stringify({ status: 'success', message: `Spreadsheet '${title}' created.`, url: result.spreadsheetUrl, spreadsheetId: result.spreadsheetId });
        } catch (error: any) {
            return `Error creating spreadsheet: ${error.message}`;
        }
    },
    { name: 'create_google_sheet', description: 'Create a new Google Spreadsheet.', schema: z.object({ title: z.string().describe('Spreadsheet title') }) }
);

const append_to_sheet = tool(
    async ({ spreadsheetId, range, values }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            await appendValues(oauth2Client, spreadsheetId, range, values);
            return JSON.stringify({ status: 'success', message: `Data appended to ${range}.` });
        } catch (error: any) {
            return `Error appending to sheet: ${error.message}`;
        }
    },
    {
        name: 'append_to_sheet',
        description: 'Append rows of data to a spreadsheet range.',
        schema: z.object({
            spreadsheetId: z.string().describe('ID of the spreadsheet'),
            range: z.string().describe('A1 notation range (e.g., "Sheet1!A1")'),
            values: z.array(z.array(z.any())).describe('2D array of values to append')
        })
    }
);

const update_spreadsheet_values = tool(
    async ({ spreadsheetId, range, values }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            await updateValues(oauth2Client, spreadsheetId, range, values);
            return JSON.stringify({ status: 'success', message: `Values updated in ${range}.` });
        } catch (error: any) {
            return `Error updating sheet: ${error.message}`;
        }
    },
    {
        name: 'update_spreadsheet_values',
        description: 'Update/overwrite a specific range in a spreadsheet.',
        schema: z.object({
            spreadsheetId: z.string().describe('ID of the spreadsheet'),
            range: z.string().describe('A1 notation range (e.g., "Sheet1!B2:D5")'),
            values: z.array(z.array(z.any())).describe('2D array of values to set')
        })
    }
);

const read_spreadsheet_values = tool(
    async ({ spreadsheetId, range }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            const data = await readValues(oauth2Client, spreadsheetId, range);
            return JSON.stringify({ status: 'success', data: data.values });
        } catch (error: any) {
            return `Error reading sheet: ${error.message}`;
        }
    },
    {
        name: 'read_spreadsheet_values',
        description: 'Read values from a spreadsheet range.',
        schema: z.object({
            spreadsheetId: z.string().describe('ID of the spreadsheet'),
            range: z.string().describe('A1 notation range (e.g., "Sheet1!A1:Z100")')
        })
    }
);

const add_sheet_tab = tool(
    async ({ spreadsheetId, title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            await batchUpdateSheet(oauth2Client, spreadsheetId, [{ addSheet: { properties: { title } } }]);
            return JSON.stringify({ status: 'success', message: `New tab '${title}' added.` });
        } catch (error: any) {
            return `Error adding tab: ${error.message}`;
        }
    },
    {
        name: 'add_sheet_tab',
        description: 'Add a new worksheet (tab) to an existing spreadsheet.',
        schema: z.object({
            spreadsheetId: z.string().describe('ID of the spreadsheet'),
            title: z.string().describe('Title for the new tab')
        })
    }
);

const format_spreadsheet = tool(
    async ({ spreadsheetId, sheetId = 0, bold, resizeColumns, fontSize, fontFamily, fontColor, backgroundColor, startRow, endRow, startCol, endCol }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });

            const requests: any[] = [];
            const range = {
                sheetId,
                startRowIndex: startRow || 0,
                endRowIndex: endRow || 1,
                startColumnIndex: startCol || 0,
                endColumnIndex: endCol || 10
            };

            const userEnteredFormat: any = { textFormat: {} };

            if (bold !== undefined) userEnteredFormat.textFormat.bold = bold;
            if (fontSize) userEnteredFormat.textFormat.fontSize = fontSize;
            if (fontFamily) userEnteredFormat.textFormat.fontFamily = fontFamily;
            if (fontColor) {
                // Simplified color hex-to-rgb conversion or just assume red/green/blue keys
                userEnteredFormat.textFormat.foregroundColor = fontColor;
            }
            if (backgroundColor) {
                userEnteredFormat.backgroundColor = backgroundColor;
            }

            if (Object.keys(userEnteredFormat.textFormat).length > 0 || backgroundColor) {
                requests.push({
                    repeatCell: {
                        range,
                        cell: { userEnteredFormat },
                        fields: 'userEnteredFormat(textFormat,backgroundColor)'
                    }
                });
            }

            if (resizeColumns) {
                requests.push({
                    autoResizeDimensions: {
                        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: range.startColumnIndex, endIndex: range.endColumnIndex }
                    }
                });
            }

            if (requests.length > 0) {
                await batchUpdateSheet(oauth2Client, spreadsheetId, requests);
            }
            return JSON.stringify({ status: 'success', message: 'Advanced formatting applied.' });
        } catch (error: any) {
            return `Error formatting sheet: ${error.message}`;
        }
    },
    {
        name: 'format_spreadsheet',
        description: 'Apply advanced formatting (fonts, sizes, colors, resize) to a spreadsheet range.',
        schema: z.object({
            spreadsheetId: z.string().describe('ID of the spreadsheet'),
            sheetId: z.number().optional().describe('ID of the tab (default: 0)'),
            bold: z.boolean().optional().describe('Set bold style'),
            fontSize: z.number().optional().describe('Font size (e.g. 12)'),
            fontFamily: z.string().optional().describe('Font family name'),
            fontColor: z.object({ red: z.number(), green: z.number(), blue: z.number() }).optional().describe('RGB color for text'),
            backgroundColor: z.object({ red: z.number(), green: z.number(), blue: z.number() }).optional().describe('RGB color for background'),
            startRow: z.number().optional(),
            endRow: z.number().optional(),
            startCol: z.number().optional(),
            endCol: z.number().optional(),
            resizeColumns: z.boolean().optional().describe('Auto-resize columns in range')
        })
    }
);

const search_spreadsheet = tool(
    async ({ title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const client = getGoogleOAuth2Client();
            client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            const files = await searchSpreadsheets(client, title);
            return JSON.stringify(files);
        } catch (error: any) {
            return `Error searching: ${error.message}`;
        }
    },
    { name: 'search_spreadsheet', description: 'Search for existing Google Spreadsheets by title.', schema: z.object({ title: z.string().optional().describe('Partial title to search for') }) }
);

const delete_spreadsheet = tool(
    async ({ spreadsheetId }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const client = getGoogleOAuth2Client();
            client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            await deleteSpreadsheet(client, spreadsheetId);
            return JSON.stringify({ status: 'success', message: 'Spreadsheet moved to trash.' });
        } catch (error: any) {
            return `Error deleting: ${error.message}`;
        }
    },
    { name: 'delete_spreadsheet', description: 'Remove a spreadsheet by ID (moves to trash).', schema: z.object({ spreadsheetId: z.string() }) }
);

const update_spreadsheet_metadata = tool(
    async ({ spreadsheetId, title, sheetId, newSheetName }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const client = getGoogleOAuth2Client();
            client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });

            if (title) {
                await renameSpreadsheet(client, spreadsheetId, title);
            }

            if (sheetId !== undefined && newSheetName) {
                await batchUpdateSheet(client, spreadsheetId, [{
                    updateSheetProperties: {
                        properties: { sheetId, title: newSheetName },
                        fields: 'title'
                    }
                }]);
            }

            return JSON.stringify({ status: 'success', message: 'Metadata updated.' });
        } catch (error: any) {
            return `Error updating metadata: ${error.message}`;
        }
    },
    {
        name: 'update_spreadsheet_metadata',
        description: 'Rename the spreadsheet file or specific tabs.',
        schema: z.object({
            spreadsheetId: z.string(),
            title: z.string().optional().describe('New title for the spreadsheet file'),
            sheetId: z.number().optional().describe('ID of the tab to rename'),
            newSheetName: z.string().optional().describe('New name for the tab')
        })
    }
);

const delete_sheet_dimensions = tool(
    async ({ spreadsheetId, sheetId = 0, dimension, startIndex, endIndex }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const client = getGoogleOAuth2Client();
            client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });
            await deleteDimensions(client, spreadsheetId, sheetId, dimension, startIndex, endIndex);
            return JSON.stringify({ status: 'success', message: `Deleted ${dimension} from ${startIndex} to ${endIndex}.` });
        } catch (error: any) {
            return `Error deleting dimensions: ${error.message}`;
        }
    },
    {
        name: 'delete_sheet_dimensions',
        description: 'Delete rows or columns from a sheet.',
        schema: z.object({
            spreadsheetId: z.string(),
            sheetId: z.number().optional().describe('ID of the tab'),
            dimension: z.enum(['ROWS', 'COLUMNS']),
            startIndex: z.number().describe('0-indexed start position'),
            endIndex: z.number().describe('0-indexed end position (exclusive)')
        })
    }
);

const add_spreadsheet_chart = tool(
    async ({ spreadsheetId, range, chartType, title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });

            // Basic range parsing (assuming Sheet1!A1:B10 format)
            const [sheetName, cellRange] = range.split('!');

            const request = {
                addChart: {
                    chart: {
                        spec: {
                            title,
                            basicChart: {
                                chartType,
                                legendPosition: 'BOTTOM_LEGEND',
                                axis: [{ position: 'BOTTOM_AXIS', title: 'Data' }, { position: 'LEFT_AXIS', title: 'Value' }],
                                domains: [{ domain: { sourceRange: { sources: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 1 }] } } }],
                                series: [{ series: { sourceRange: { sources: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 1, endColumnIndex: 2 }] } }, targetAxis: 'LEFT_AXIS' }]
                            }
                        },
                        position: { newSheet: true } // Create chart in a new sheet for visibility
                    }
                }
            };

            await batchUpdateSheet(oauth2Client, spreadsheetId, [request]);
            return JSON.stringify({ status: 'success', message: `${chartType} chart '${title}' created.` });
        } catch (error: any) {
            return `Error adding chart: ${error.message}`;
        }
    },
    {
        name: 'add_spreadsheet_chart',
        description: 'Create a chart (PIE, BAR, COLUMN, LINE) in the spreadsheet.',
        schema: z.object({
            spreadsheetId: z.string().describe('ID of the spreadsheet'),
            range: z.string().describe('Data range (e.g., "Sheet1!A1:B10")'),
            chartType: z.enum(['BAR', 'COLUMN', 'LINE', 'PIE']).describe('Type of chart'),
            title: z.string().describe('Chart title')
        })
    }
);

const set_spreadsheet_colors = tool(
    async ({ spreadsheetId, range, theme }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const tokens = await getUserTokens(userId);
            const oauth2Client = getGoogleOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: tokens.refreshToken, access_token: tokens.accessToken });

            const requests: any[] = [];
            if (theme === 'ZEBRA') {
                requests.push({
                    addBanding: {
                        bandingProperties: {
                            range: { sheetId: 0, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 20 },
                            rowStyles: [
                                { color: { red: 0.95, green: 0.95, blue: 0.95 } },
                                { color: { red: 1, green: 1, blue: 1 } }
                            ]
                        }
                    }
                });
            }

            if (requests.length > 0) {
                await batchUpdateSheet(oauth2Client, spreadsheetId, requests);
            }
            return JSON.stringify({ status: 'success', message: 'Visual theme applied.' });
        } catch (error: any) {
            return `Error applying colors: ${error.message}`;
        }
    },
    {
        name: 'set_spreadsheet_colors',
        description: 'Apply visual themes like Zebra stripes (alternating row colors).',
        schema: z.object({
            spreadsheetId: z.string().describe('ID of the spreadsheet'),
            range: z.string().optional().describe('Range to apply (defaults to all)'),
            theme: z.enum(['ZEBRA']).describe('Visual theme to apply')
        })
    }
);

// 4. Handoff Tools (For the Handoffs Pattern)
const transfer_to_google_ads = tool(
    async () => {
        return "Transferred to Google Ads Specialist. You can now process marketing queries.";
    },
    {
        name: 'transfer_to_google_ads',
        description: 'Call this tool to transfer control to the Google Ads specialist for any marketing, ads, or performance data queries.',
        schema: z.object({})
    }
);

const transfer_to_google_sheets = tool(
    async () => {
        return "Transferred to Google Sheets Specialist. You can now process spreadsheet management tasks.";
    },
    {
        name: 'transfer_to_google_sheets',
        description: 'Call this tool to transfer control to the Google Sheets specialist for creating, reading, updating, or formatting spreadsheets.',
        schema: z.object({})
    }
);





// 5. Reporting Tools
// 5. Reporting Tools



const adsTools = [get_account_overview, get_performance_data, get_live_google_ads_data, get_granular_analytics]; // Removed transfer_to_google_sheets
const sheetsTools = [
    create_google_sheet,
    append_to_sheet,
    update_spreadsheet_values,
    read_spreadsheet_values,
    add_sheet_tab,
    format_spreadsheet,
    add_spreadsheet_chart,
    set_spreadsheet_colors,
    search_spreadsheet,
    delete_spreadsheet,
    update_spreadsheet_metadata,
    delete_sheet_dimensions,
    transfer_to_google_ads
];

// ============= MULTI-AGENT NODES =============

// Shared Model Factory
const createAgentModel = (tools: any[], systemPrompt: string) => {
    return async (state: typeof RootState.State) => {
        const now = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
        const model = new ChatOpenAI({
            apiKey: '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',
            model: 'xiaomi/mimo-v2-flash:free',
            configuration: { baseURL: 'https://openrouter.ai/api/v1' },
            temperature: 0,
            metadata: { agentTag: "worker" }
        }).bindTools(tools);

        // Context Trimming: Keep last 30 messages to prevent 400 errors or extreme latency
        // Gemini has a large window, but keeping it lean is still better for speed and cost.
        const trimmedMessages = state.messages.length > 30
            ? [state.messages[0], ...state.messages.slice(-29)]
            : state.messages;

        const response = await model.invoke([
            {
                role: "system",
                content: `${systemPrompt}\n\nCURRENT_UTC_TIME: ${now}${state.accountId ? `\nCURRENT_ACCOUNT_ID: ${state.accountId}` : ''}${state.spreadsheetId ? `\nCURRENT_SPREADSHEET_ID: ${state.spreadsheetId}` : ''}`
            },
            ...trimmedMessages
        ]);

        // Fallback for empty responses to avoid "model output must contain either output text or tool calls" errors
        if (!response.content && (!response.additional_kwargs?.tool_calls || response.additional_kwargs.tool_calls.length === 0)) {
            response.content = "I'm sorry, I couldn't generate a specific response. Please try rephrasing your request.";
        }

        // Harvesting logic: Extract IDs from conversation history if state slots are empty
        let activeAccountId = state.accountId;
        let activeSheetId = state.spreadsheetId;

        if (!activeAccountId || !activeSheetId) {
            const historyText = state.messages
                .slice(-5)
                .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
                .join(' ');

            if (!activeAccountId) {
                const hyphenated = historyText.match(/\b\d{3}-\d{3}-\d{4}\b/);
                if (hyphenated) activeAccountId = hyphenated[0];
                else {
                    const jsonMatch = historyText.match(/["']accountId["']:\s*["'](\d{10})["']/);
                    if (jsonMatch) activeAccountId = jsonMatch[1];
                }
            }
            if (!activeSheetId) {
                const sheetMatch = historyText.match(/\b[a-zA-Z0-9-_]{44}\b/);
                if (sheetMatch) activeSheetId = sheetMatch[0];
            }
        }

        return {
            messages: [response],
            accountId: activeAccountId,
            spreadsheetId: activeSheetId
        };
    };
};

// 1. Google Ads Agent
const googleAdsAgent = createAgentModel(adsTools, `You are the Google Ads Specialist. 
Your goal is to analyze marketing performance and retrieve account data. 

Guidelines:
1. ALWAYS call get_account_overview first if you don't have a specific numeric Account ID.
2. If the user provides an account name, map it to an ID using get_account_overview.
3. You can fetch historical performance from the database or LIVE data directly from Google.
4. IMPORTANT: If get_performance_data returns a NO_HISTORICAL_DATA error, immediately use get_live_google_ads_data instead with the same parameters. Do not ask the user - just switch to live data automatically.
5. IMPORTANT: If the user wants to save this data to a sheet, create a report, or do anything spreadsheet-related, you MUST use the transfer_to_google_sheets tool after you have the data.
6. DO NOT output conversational filler like "Let me check..." or "I will fetch...". JUST call the tools directly.

DATE RANGE RULES (CRITICAL):
- NEVER use future dates. Today is ${new Date().toISOString().split('T')[0]}.
- If user says "yesterday": use yesterday's date for both start and end
- If user says "last 7 days": use 7 days ago to yesterday
- If user says "last 30 days": use 30 days ago to yesterday
- If user says "this month": use first day of current month to yesterday
- If user doesn't specify: DEFAULT to last 30 days (30 days ago to yesterday)
- Format dates as YYYY-MM-DD
- ALWAYS use dates in the PAST, never future dates

OUTPUT FORMATTING RULES (CRITICAL):
- ALWAYS present performance data in markdown tables
- Use tables for ANY data with multiple rows (campaigns, metrics, dates, etc.)
- Include relevant columns: Campaign Name, Impressions, Clicks, CTR, Cost, Conversions, etc.
- Format numbers properly: costs with 2 decimals, percentages with %, whole numbers for impressions/clicks
- Add a brief summary BEFORE the table (1-2 sentences max)
- Example format:
  
  Here's the performance data for the last 30 days:
  
  | Campaign | Impressions | Clicks | CTR | Cost | Conversions |
  |----------|-------------|--------|-----|------|-------------|
  | Campaign 1 | 10,000 | 500 | 5.0% | $250.00 | 25 |
  
- If showing data over time, use Date as the first column
`);

// 2. Google Sheets Agent
const googleSheetsAgent = createAgentModel(sheetsTools, `You are a Google Sheets Specialist. You have full administrative control over spreadsheets.
Capabilities:
- CREATE, SEARCH, DELETE, and RENAME spreadsheets.
- READ, APPEND, and UPDATE cell data.
- FORMAT and VISUALIZE (Charts, Zebra stripes).

Guidelines:
1. If the user's request requires marketing data that you don't have, use the transfer_to_google_ads tool to fetch it.
2. Always provide a clear summary of what was changed.
3. Use 0-indexed values for rows/columns.
4. DO NOT output conversational filler like "Let me check...". Call tools directly.`);



// 4. Reporting Agent


// 3. Initial Router Node (Reduced Supervisor)
const initialRouter = async (state: typeof MessagesAnnotation.State) => {
    const routerModel = new ChatOpenAI({
        apiKey: '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',
        model: 'openai/gpt-4o-mini',
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
        temperature: 0,
        metadata: { agentTag: "supervisor" }
    }).withStructuredOutput(
        z.object({
            next: z.enum(["ADS_AGENT", "SHEETS_AGENT"]),
            reasoning: z.string().describe("Brief explanation of why this agent was chosen.")
        })
    );

    const systemPrompt = `You are a router deciding which specialist to send the user's query to.
1. ADS_AGENT: For Google Ads marketing data, ads performance, and account overviews.

If the request involves both, start with the most logical one (usually ADS_AGENT to get data first).`;
    // 2. SHEETS_AGENT: For creating reports in Google Sheets, managing spreadsheets, and formatting data.

    // Trim for router too
    const trimmedMessages = state.messages.length > 20
        ? [state.messages[0], ...state.messages.slice(-19)]
        : state.messages;

    const response = await routerModel.invoke([
        { role: "system", content: systemPrompt },
        ...trimmedMessages
    ]);

    console.log(`[Router] Decision: ${response.next} `);
    return { next: response.next, reasoning: response.reasoning };
};

// ============= GRAPH CONSTRUCTION =============



const workflow = new StateGraph(RootState)
    .addNode("router", initialRouter)
    .addNode("googleAdsAgent", googleAdsAgent)
    // .addNode("googleSheetsAgent", googleSheetsAgent)
    .addNode("adsTools", new ToolNode(adsTools));
// .addNode("sheetsTools", new ToolNode(sheetsTools));

// Entry: User -> Router
workflow.addEdge("__start__", "router");

// Initial Routing
// Initial Routing
workflow.addConditionalEdges("router", (state) => state.next, {
    ADS_AGENT: "googleAdsAgent",
    // SHEETS_AGENT: "googleSheetsAgent"
});

// Ads Agent Handoff logic
workflow.addConditionalEdges("googleAdsAgent", (state) => {
    const lastMsg = state.messages[state.messages.length - 1];
    const calls = lastMsg?.additional_kwargs?.tool_calls;
    if (calls?.length) {
        // if (calls.some(c => c.function.name === 'transfer_to_google_sheets')) return "googleSheetsAgent";
        return "adsTools";
    }
    return "__end__";
}, {
    adsTools: "adsTools",
    // googleSheetsAgent: "googleSheetsAgent",
    __end__: "__end__"
});

// Sheets Agent Handoff logic
// Sheets Agent Handoff logic
/*
workflow.addConditionalEdges("googleSheetsAgent", (state) => {
    const lastMsg = state.messages[state.messages.length - 1];
    const calls = lastMsg?.additional_kwargs?.tool_calls;
    if (calls?.length) {
        if (calls.some(c => c.function.name === 'transfer_to_google_ads')) return "googleAdsAgent";
        return "sheetsTools";
    }
    return "__end__";
}, {
    sheetsTools: "sheetsTools",
    googleAdsAgent: "googleAdsAgent",
    __end__: "__end__"
});
*/

// Reporting Agent Handoff logic


// Tools return to their respective agents
workflow.addEdge("adsTools", "googleAdsAgent");
// workflow.addEdge("sheetsTools", "googleSheetsAgent");


const checkpointer = new MemorySaver();
export const nexusAgent = workflow.compile({ checkpointer });

