import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsApi } from 'google-ads-api';
import { google } from 'googleapis';
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
        const managerId = searchParams.get('managerId');
        const email = searchParams.get('email');

        console.log(`DEBUG [accounts]: userId=${userId}, email=${email}`);

        // Get stored tokens - prioritize searching by email if provided
        let tokenRecord;
        try {
            if (email) {
                tokenRecord = await prisma.oAuthToken.findUnique({
                    where: {
                        userId_provider_email: {
                            userId: userId,
                            provider: 'google',
                            email: email
                        },
                    },
                });
            } else {
                // Fallback to most recent google token if no email specified
                tokenRecord = await prisma.oAuthToken.findFirst({
                    where: {
                        userId: userId,
                        provider: 'google',
                    },
                    orderBy: { updatedAt: 'desc' }
                });
            }
        } catch (dbErr) {
            console.error('DEBUG [accounts]: Database error:', dbErr);
            return NextResponse.json({ error: 'Database error', detail: String(dbErr) }, { status: 500 });
        }

        if (!tokenRecord) {
            return NextResponse.json({ error: 'No OAuth tokens found' }, { status: 401 });
        }

        // --- Token Refresh Logic ---
        let accessToken = tokenRecord.accessToken;
        const now = new Date();
        const buffer = 5 * 60 * 1000; // 5 minute buffer

        if (tokenRecord.expiresAt && (new Date(tokenRecord.expiresAt).getTime() - now.getTime() < buffer) && tokenRecord.refreshToken) {
            console.log('DEBUG [accounts]: Token expired or expiring soon, attempting refresh...');
            try {
                const oauth2Client = new google.auth.OAuth2(
                    credentials.client_id,
                    credentials.client_secret,
                    `${request.nextUrl.origin}/api/google/oauth/callback`
                );
                oauth2Client.setCredentials({
                    refresh_token: tokenRecord.refreshToken
                });

                const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();

                if (newCredentials && newCredentials.access_token) {
                    accessToken = newCredentials.access_token;

                    // Update DB
                    await prisma.oAuthToken.update({
                        where: { id: tokenRecord.id },
                        data: {
                            accessToken: newCredentials.access_token,
                            expiresAt: newCredentials.expiry_date ? new Date(newCredentials.expiry_date) : new Date(Date.now() + 3600 * 1000),
                            updatedAt: new Date()
                        }
                    });
                    console.log('DEBUG [accounts]: Token refreshed successfully.');
                } else {
                    console.error('DEBUG [accounts]: Token refresh succeeded but returned no access token.');
                }
            } catch (refreshErr: any) {
                console.error('DEBUG [accounts]: Token refresh failed:', refreshErr.message);
                // Continue anyway, maybe it still works
            }
        }

        // Initialize Google Ads API client
        const adsClient = new GoogleAdsApi({
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        });

        const accounts = [];
        let resourceNames = [];

        if (managerId) {
            // FETCH SUB-ACCOUNTS for a specific manager
            console.log('DEBUG: Fetching logic for managerId:', managerId);
            const customer = adsClient.Customer({
                customer_id: managerId.replace(/-/g, ''),
                refresh_token: tokenRecord.refreshToken || '',
            } as any);

            const results = await customer.query(`
                SELECT
                    customer_client.id,
                    customer_client.descriptive_name,
                    customer_client.currency_code,
                    customer_client.manager,
                    customer_client.test_account,
                    customer_client.level
                FROM customer_client
                WHERE customer_client.level = 1
            `);

            for (const row of results) {
                const c = row.customer_client;
                if (c) {
                    accounts.push({
                        id: (c.id || '').toString(),
                        name: c.descriptive_name || `Account ${c.id}`,
                        currency: c.currency_code || 'USD',
                        status: c.test_account ? 'TEST' : 'ENABLED',
                        isManager: !!c.manager,
                        parentId: managerId
                    });
                }
            }

            return NextResponse.json({ accounts });
        } else {
            // FETCH TOP-LEVEL ACCESSIBLE CUSTOMERS
            try {
                console.log('DEBUG [accounts]: Calling listAccessibleCustomers...');
                const response = await adsClient.listAccessibleCustomers(accessToken);
                resourceNames = (response as any).resource_names || (Array.isArray(response) ? response : []);
                console.log(`DEBUG [accounts]: Found ${resourceNames.length} resource names:`, resourceNames);
            } catch (apiErr: any) {
                console.error('API Error in listAccessibleCustomers:', apiErr.message);

                // If it's a developer token error, we'll log it and continue to mock data
                if (apiErr.message?.includes('DEVELOPER_TOKEN_NOT_APPROVED') || apiErr.message?.includes('DEVELOPER_TOKEN_PROHIBITED')) {
                    console.error('CRITICAL: Google Ads Developer Token Issue detected.');
                }

                // Don't return 502 here, let it fall through to the mock data fallback below
                console.log('DEBUG [accounts]: Live discovery failed, will proceed to mock fallback.');
            }

            // Fetch details for each customer ID
            for (const resourceName of resourceNames) {
                try {
                    const cleanId = resourceName.split('/')[1];
                    const customer = adsClient.Customer({
                        customer_id: cleanId,
                        refresh_token: tokenRecord.refreshToken || '',
                    });

                    const details = await customer.query(`
                        SELECT
                            customer.id,
                            customer.descriptive_name,
                            customer.currency_code,
                            customer.manager,
                            customer.test_account
                        FROM customer
                        LIMIT 1
                    `);

                    if (details && details.length > 0) {
                        const c = details[0].customer;
                        if (c) {
                            accounts.push({
                                id: (c.id || '').toString(),
                                name: c.descriptive_name || `Account ${c.id}`,
                                currency: c.currency_code || 'USD',
                                status: c.test_account ? 'TEST' : 'ENABLED',
                                isManager: !!c.manager,
                            });
                        }
                    } else {
                        // If query fails, at least provide the ID
                        accounts.push({
                            id: cleanId,
                            name: `Account ${cleanId}`,
                            currency: '---',
                            status: 'ENABLED',
                            isManager: false,
                        });
                    }
                } catch (err) {
                    console.error(`Error fetching details for account ${resourceName}:`, err);
                    const cleanId = resourceName.split('/')[1];
                    accounts.push({
                        id: cleanId,
                        name: `Account ${cleanId}`,
                        currency: '---',
                        status: 'CHECK_PERMISSIONS',
                        isManager: false,
                    });
                }
            }

            console.log(`DEBUG [accounts]: Discovery finished. Found ${accounts.length} accounts.`);

            // If no accounts found and no developer token, or if it just failed to find anything, 
            // provide mock accounts so the user can at least test the UI flow.
            if (accounts.length === 0) {
                console.log('DEBUG [accounts]: No accounts found, providing mock data for testing');
                const mockAccounts = [
                    { id: '1234567890', name: 'Premium Marketing [Mock]', currency: 'USD', status: 'ENABLED', isManager: false },
                    { id: '0987654321', name: 'Global Retail [Mock]', currency: 'EUR', status: 'ENABLED', isManager: false },
                ];
                return NextResponse.json({
                    accounts: mockAccounts,
                    note: 'Provided mock accounts because no live accounts were discovered. Ensure GOOGLE_ADS_DEVELOPER_TOKEN is set for live discovery.'
                });
            }

            return NextResponse.json({
                accounts,
                debug: {
                    count: accounts.length,
                    hasToken: !!accessToken,
                    hasDevToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN
                }
            });
        }
    } catch (error) {
        console.error('Google Ads accounts fetch error:', error);

        // Return 401 for authentication errors
        if (error instanceof Error && (error.message === 'Not authenticated' || error.message === 'Invalid token')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        // Fallback to mock data if API fails
        const mockAccounts = [
            {
                id: '123-456-7890',
                name: 'Premium Marketing Account',
                currency: 'USD',
                status: 'ENABLED',
            },
            {
                id: '098-765-4321',
                name: 'Global Retail - Google Ads',
                currency: 'EUR',
                status: 'ENABLED',
            },
            {
                id: '555-444-3333',
                name: 'Internal Brand Testing',
                currency: 'USD',
                status: 'ENABLED',
            },
        ];

        return NextResponse.json({
            accounts: mockAccounts,
            note: 'Using mock data - Google Ads API integration requires developer token and customer ID'
        });
    }
}
