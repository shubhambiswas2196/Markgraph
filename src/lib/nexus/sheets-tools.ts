import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
    createGoogleSheet,
    searchSpreadsheets,
    readValues,
    appendValues,
    updateValues,
    getGoogleOAuth2Client,
    deleteSpreadsheet,
    renameSpreadsheet,
    batchUpdateSheet,
    deleteDimensions
} from '@/lib/google-sheets';
import { getUserTokens } from '@/lib/google-ads';

// Helper to get Auth client
async function getAuth(userId: number) {
    const tokens = await getUserTokens(userId);
    const oauth2Client = getGoogleOAuth2Client();
    oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expiry_date: tokens.expiresAt ? new Date(tokens.expiresAt).getTime() : undefined
    });
    return oauth2Client;
}

export const create_google_sheet = tool(
    async ({ title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return JSON.stringify({ status: 'error', message: 'User ID not found' });

        // Validate title
        if (!title || title.trim().length === 0) {
            return JSON.stringify({
                status: 'error',
                message: 'Title cannot be empty. Please provide a valid spreadsheet title.'
            });
        }

        if (title.length > 255) {
            return JSON.stringify({
                status: 'error',
                message: 'Title too long (max 255 characters). Please use a shorter title.'
            });
        }

        try {
            const auth = await getAuth(userId);
            const res = await createGoogleSheet(auth, title);
            return JSON.stringify({
                status: 'success',
                message: `✅ Spreadsheet '${title}' created successfully.`,
                url: res.spreadsheetUrl,
                spreadsheetId: res.spreadsheetId
            });
        } catch (e: any) {
            // Categorize errors for better AI understanding
            if (e.message.includes('invalid_grant') || e.message.includes('Token') || e.message.includes('401')) {
                return JSON.stringify({
                    status: 'error',
                    type: 'AUTH_ERROR',
                    message: 'Authentication failed. User needs to reconnect Google account.',
                    action: 'Please ask the user to reconnect their Google account in Settings.'
                });
            }

            if (e.message.includes('permission') || e.message.includes('403')) {
                return JSON.stringify({
                    status: 'error',
                    type: 'PERMISSION_ERROR',
                    message: 'Insufficient permissions to access Google Sheets.',
                    action: 'User needs to grant Sheets API access during OAuth.'
                });
            }

            if (e.message.includes('quota') || e.message.includes('429')) {
                return JSON.stringify({
                    status: 'error',
                    type: 'QUOTA_ERROR',
                    message: 'Google Sheets API quota exceeded.',
                    action: 'Please wait a few minutes and try again.'
                });
            }

            return JSON.stringify({
                status: 'error',
                type: 'UNKNOWN_ERROR',
                message: `Error creating sheet: ${e.message}`,
                action: 'Please try again or check the error details.'
            });
        }
    },
    {
        name: 'create_google_sheet',
        description: 'Create a new Google Spreadsheet.',
        schema: z.object({
            title: z.string().describe('The title of the new spreadsheet.')
        })
    }
);

export const list_spreadsheets = tool(
    async ({ query }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            const files = await searchSpreadsheets(auth, query);
            if (files.length === 0) return "No spreadsheets found.";
            return JSON.stringify(files.map(f => ({ id: f.id, name: f.name, link: f.webViewLink })));
        } catch (e: any) {
            return `Error listing sheets: ${e.message}`;
        }
    },
    {
        name: 'list_spreadsheets',
        description: 'Search for existing Google Sheets.',
        schema: z.object({
            query: z.string().optional().describe('Optional title keyword to search for.')
        })
    }
);

export const search_spreadsheet = tool(
    async ({ title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            const files = await searchSpreadsheets(auth, title);
            return JSON.stringify(files);
        } catch (error: any) {
            return `Error searching: ${error.message}`;
        }
    },
    { name: 'search_spreadsheet', description: 'Search for existing Google Spreadsheets by title.', schema: z.object({ title: z.string().optional().describe('Partial title to search for') }) }
);

export const read_sheet_data = tool(
    async ({ spreadsheetId, range }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            const data = await readValues(auth, spreadsheetId, range || 'Sheet1!A1:Z100');
            return JSON.stringify({ status: 'success', data: data.values });
        } catch (e: any) {
            return `Error reading sheet: ${e.message}`;
        }
    },
    {
        name: 'read_sheet_data',
        description: 'Read data from a specific range in a Google Sheet.',
        schema: z.object({
            spreadsheetId: z.string().describe('The ID of the spreadsheet.'),
            range: z.string().optional().describe('The A1 notation range (e.g., "Sheet1!A1:B10"). Defaults to a large range.')
        })
    }
);

export const append_to_sheet = tool(
    async ({ spreadsheetId, range, values }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            await appendValues(auth, spreadsheetId, range, values);
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
            values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).describe('2D array of values to append (strings, numbers, or booleans)')
        })
    }
);

export const update_spreadsheet_values = tool(
    async ({ spreadsheetId, range, values }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            await updateValues(auth, spreadsheetId, range, values);
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
            values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).describe('2D array of values to set (strings, numbers, or booleans)')
        })
    }
);

export const add_sheet_tab = tool(
    async ({ spreadsheetId, title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            await batchUpdateSheet(auth, spreadsheetId, [{ addSheet: { properties: { title } } }]);
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

export const delete_spreadsheet = tool(
    async ({ spreadsheetId }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            await deleteSpreadsheet(auth, spreadsheetId);
            return JSON.stringify({ status: 'success', message: 'Spreadsheet moved to trash.' });
        } catch (error: any) {
            return `Error deleting: ${error.message}`;
        }
    },
    { name: 'delete_spreadsheet', description: 'Remove a spreadsheet by ID (moves to trash).', schema: z.object({ spreadsheetId: z.string() }) }
);

export const update_spreadsheet_metadata = tool(
    async ({ spreadsheetId, title, sheetId, newSheetName }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);

            if (title) {
                await renameSpreadsheet(auth, spreadsheetId, title);
            }

            if (sheetId !== undefined && newSheetName) {
                await batchUpdateSheet(auth, spreadsheetId, [{
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

export const delete_sheet_dimensions = tool(
    async ({ spreadsheetId, sheetId = 0, dimension, startIndex, endIndex }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            await deleteDimensions(auth, spreadsheetId, sheetId, dimension, startIndex, endIndex);
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

export const add_spreadsheet_chart = tool(
    async ({ spreadsheetId, range, chartType, title }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
            const request = {
                addChart: {
                    chart: {
                        spec: {
                            title,
                            basicChart: {
                                chartType,
                                legendPosition: 'BOTTOM_LEGEND',
                                axis: [{ position: 'BOTTOM_AXIS', title: 'Data' }, { position: 'LEFT_AXIS', title: 'Value' }],
                                domains: [{ domain: { sourceRange: { sources: [parseRange(range)] } } }],
                                series: [{ series: { sourceRange: { sources: [parseRange(range, true)] } }, targetAxis: 'LEFT_AXIS' }]
                            }
                        },
                        position: { newSheet: true }
                    }
                }
            };

            // Helper to parse A1 range to GridRange object
            function parseRange(a1Range: string, isSeries = false) {
                // Simplified A1 parser (Sheet1!A1:B10)
                const [sheetName, range] = a1Range.includes('!') ? a1Range.split('!') : ['Sheet1', a1Range];
                const [start, end] = range.split(':');
                const startCol = start.charCodeAt(0) - 65;
                const startRow = parseInt(start.substring(1)) - 1;
                const endCol = end.charCodeAt(0) - 65 + 1;
                const endRow = parseInt(end.substring(1));

                if (isSeries) {
                    return { sheetId: 0, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol + 1, endColumnIndex: endCol };
                }
                return { sheetId: 0, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: startCol + 1 };
            }

            await batchUpdateSheet(auth, spreadsheetId, [request]);
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

export const format_spreadsheet = tool(
    async ({ spreadsheetId, sheetId = 0, bold, resizeColumns, fontSize, fontFamily, fontColor, backgroundColor, horizontalAlignment, verticalAlignment, borders, startRow, endRow, startCol, endCol }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
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
            if (fontColor) userEnteredFormat.textFormat.foregroundColor = fontColor;
            if (backgroundColor) userEnteredFormat.backgroundColor = backgroundColor;
            if (horizontalAlignment) userEnteredFormat.horizontalAlignment = horizontalAlignment;
            if (verticalAlignment) userEnteredFormat.verticalAlignment = verticalAlignment;

            if (borders) {
                userEnteredFormat.borders = {
                    top: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                    bottom: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                    left: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                    right: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } }
                };
            }

            if (Object.keys(userEnteredFormat.textFormat).length > 0 || backgroundColor || horizontalAlignment || verticalAlignment || borders) {
                requests.push({
                    repeatCell: {
                        range,
                        cell: { userEnteredFormat },
                        fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,borders)'
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
                await batchUpdateSheet(auth, spreadsheetId, requests);
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
            horizontalAlignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional().describe('Horizontal alignment'),
            verticalAlignment: z.enum(['TOP', 'MIDDLE', 'BOTTOM']).optional().describe('Vertical alignment'),
            borders: z.boolean().optional().describe('Apply solid black borders to cells'),
            startRow: z.number().optional().describe('0-indexed start row'),
            endRow: z.number().optional().describe('0-indexed end row'),
            startCol: z.number().optional().describe('0-indexed start column'),
            endCol: z.number().optional().describe('0-indexed end column'),
            resizeColumns: z.boolean().optional().describe('Auto-resize columns in range')
        })
    }
);

export const set_spreadsheet_colors = tool(
    async ({ spreadsheetId, range, theme }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return "Error: User ID not found.";
        try {
            const auth = await getAuth(userId);
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
                await batchUpdateSheet(auth, spreadsheetId, requests);
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

export const export_metrics_to_sheets = tool(
    async ({ title, data, headers }, config) => {
        const userId = config.configurable?.userId;
        if (!userId) return JSON.stringify({ status: 'error', message: 'User ID not found' });

        try {
            const auth = await getAuth(userId);

            // Create sheet
            const sheet = await createGoogleSheet(auth, title);
            const spreadsheetId = sheet.spreadsheetId!;

            // Add headers
            if (headers && headers.length > 0) {
                await appendValues(auth, spreadsheetId, 'Sheet1!A1', [headers]);

                // Format headers (bold, background color)
                await batchUpdateSheet(auth, spreadsheetId, [{
                    repeatCell: {
                        range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: true },
                                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                            }
                        },
                        fields: 'userEnteredFormat(textFormat,backgroundColor)'
                    }
                }]);
            }

            // Add data
            if (data && data.length > 0) {
                await appendValues(auth, spreadsheetId, 'Sheet1!A2', data);
            }

            // Auto-resize columns
            await batchUpdateSheet(auth, spreadsheetId, [{
                autoResizeDimensions: {
                    dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: headers?.length || 10 }
                }
            }]);

            return JSON.stringify({
                status: 'success',
                message: `✅ Successfully exported ${data.length} rows to Google Sheets`,
                url: sheet.spreadsheetUrl,
                spreadsheetId: spreadsheetId,
                rowCount: data.length,
                columnCount: headers?.length || 0
            });
        } catch (e: any) {
            // Categorize errors for better AI understanding
            if (e.message.includes('invalid_grant') || e.message.includes('Token') || e.message.includes('401')) {
                return JSON.stringify({
                    status: 'error',
                    type: 'AUTH_ERROR',
                    message: 'Authentication failed. User needs to reconnect Google account.',
                    action: 'Please ask the user to reconnect their Google account in Settings.'
                });
            }

            if (e.message.includes('permission') || e.message.includes('403')) {
                return JSON.stringify({
                    status: 'error',
                    type: 'PERMISSION_ERROR',
                    message: 'Insufficient permissions to access Google Sheets.',
                    action: 'User needs to grant Sheets API access during OAuth.'
                });
            }

            if (e.message.includes('quota') || e.message.includes('429')) {
                return JSON.stringify({
                    status: 'error',
                    type: 'QUOTA_ERROR',
                    message: 'Google Sheets API quota exceeded.',
                    action: 'Please wait a few minutes and try again.'
                });
            }

            return JSON.stringify({
                status: 'error',
                type: 'UNKNOWN_ERROR',
                message: e.message,
                action: 'Please try again or check the error details.'
            });
        }
    },
    {
        name: 'export_metrics_to_sheets',
        description: 'Export advertising metrics data to a new Google Sheet with automatic formatting. This is a HIGH-LEVEL tool that creates a sheet, adds headers with bold formatting, adds data, and auto-resizes columns all in ONE call. Use this instead of chaining multiple tools for exporting campaign data.',
        schema: z.object({
            title: z.string().describe('Title for the new spreadsheet (e.g., "Campaign Performance - Jan 2026")'),
            headers: z.array(z.string()).describe('Column headers (e.g., ["Campaign", "Impressions", "Clicks", "Cost"])'),
            data: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).describe('2D array of data rows')
        })
    }
);

export const transfer_to_google_ads = tool(
    async () => {
        return "Transferring to Google Ads Agent...";
    },
    {
        name: 'transfer_to_google_ads',
        description: 'Hand off control to the Google Ads Agent.',
        schema: z.object({})
    }
);

export const sheetsTools = [
    create_google_sheet,
    export_metrics_to_sheets,
    append_to_sheet,
    update_spreadsheet_values,
    read_sheet_data,
    add_sheet_tab,
    format_spreadsheet,
    add_spreadsheet_chart,
    set_spreadsheet_colors,
    search_spreadsheet,
    delete_spreadsheet,
    update_spreadsheet_metadata,
    delete_sheet_dimensions,
    transfer_to_google_ads,
    list_spreadsheets
];
