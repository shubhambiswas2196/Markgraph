import { google } from 'googleapis';
import credentialsFile from '../../SyncMaster.json';

// Support both 'web' and 'installed' OAuth configurations
const credentials = (credentialsFile as any).web || (credentialsFile as any).installed;

if (!credentials) {
    throw new Error('No valid OAuth credentials found in SyncMaster.json. Please ensure either "web" or "installed" configuration exists.');
}

export function getGoogleOAuth2Client() {
    return new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uris[0]
    );
}

export async function createGoogleSheet(auth: any, title: string) {
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    const resource = {
        properties: {
            title,
        },
    };
    try {
        const spreadsheet = await sheets.spreadsheets.create({
            requestBody: resource,
            fields: 'spreadsheetId,spreadsheetUrl',
        });

        const spreadsheetId = spreadsheet.data.spreadsheetId;
        const manualUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

        // Try to make it public/editable, but don't fail if it's restricted by Org Policy
        if (spreadsheetId) {
            try {
                await drive.permissions.create({
                    fileId: spreadsheetId,
                    requestBody: {
                        role: 'writer',
                        type: 'anyone'
                    }
                });
            } catch (permErr) {
                console.warn(`[Google Sheets] Warning: Could not make sheet public (likely Org Policy). User will need to be signed in. Error: ${permErr}`);
            }
        }

        console.log(`[Google Sheets] Created sheet: ${manualUrl}`);

        return {
            status: 'success',
            spreadsheetId: spreadsheetId,
            spreadsheetUrl: manualUrl, // Use robust manual URL
        };
    } catch (err: any) {
        throw new Error(`Failed to create spreadsheet: ${err.message}`);
    }
}

export async function appendValues(auth: any, spreadsheetId: string, range: string, values: any[][]) {
    const sheets = google.sheets({ version: 'v4', auth });
    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return response.data;
    } catch (err: any) {
        throw new Error(`Failed to append values: ${err.message}`);
    }
}

export async function updateValues(auth: any, spreadsheetId: string, range: string, values: any[][]) {
    const sheets = google.sheets({ version: 'v4', auth });
    try {
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return response.data;
    } catch (err: any) {
        throw new Error(`Failed to update values: ${err.message}`);
    }
}

export async function readValues(auth: any, spreadsheetId: string, range: string) {
    const sheets = google.sheets({ version: 'v4', auth });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        return response.data;
    } catch (err: any) {
        throw new Error(`Failed to read values: ${err.message}`);
    }
}

export async function batchUpdateSheet(auth: any, spreadsheetId: string, requests: any[]) {
    const sheets = google.sheets({ version: 'v4', auth });
    try {
        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests },
        });
        return response.data;
    } catch (err: any) {
        throw new Error(`Failed batch update: ${err.message}`);
    }
}

export async function searchSpreadsheets(auth: any, title?: string) {
    const drive = google.drive({ version: 'v3', auth });
    try {
        const query = title
            ? `name contains '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
            : `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;

        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name, webViewLink)',
            pageSize: 10
        });
        return response.data.files || [];
    } catch (err: any) {
        throw new Error(`Failed to search spreadsheets: ${err.message}`);
    }
}

export async function deleteSpreadsheet(auth: any, spreadsheetId: string) {
    const drive = google.drive({ version: 'v3', auth });
    try {
        // Move to trash
        const response = await drive.files.update({
            fileId: spreadsheetId,
            requestBody: { trashed: true }
        });
        return response.data;
    } catch (err: any) {
        throw new Error(`Failed to delete spreadsheet: ${err.message}`);
    }
}

export async function renameSpreadsheet(auth: any, spreadsheetId: string, title: string) {
    const drive = google.drive({ version: 'v3', auth });
    try {
        const response = await drive.files.update({
            fileId: spreadsheetId,
            requestBody: { name: title }
        });
        return response.data;
    } catch (err: any) {
        throw new Error(`Failed to rename spreadsheet: ${err.message}`);
    }
}

export async function deleteDimensions(auth: any, spreadsheetId: string, sheetId: number, dimension: 'ROWS' | 'COLUMNS', startIndex: number, endIndex: number) {
    return batchUpdateSheet(auth, spreadsheetId, [{
        deleteDimension: {
            range: {
                sheetId,
                dimension,
                startIndex,
                endIndex
            }
        }
    }]);
}
