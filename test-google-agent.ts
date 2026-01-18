
import { GoogleAdsApi } from 'google-ads-api';
import { PrismaClient } from '@prisma/client';
import credentialsFile from './SyncMaster.json';

const prisma = new PrismaClient();
const credentials = credentialsFile.installed;

async function main() {
    const userId = 2; // Assuming user 2 based on check-sources.js

    console.log(`Testing Google Agent for UserId: ${userId}`);

    // 1. Get Tokens
    try {
        const tokenRecord = await prisma.oAuthToken.findFirst({
            where: {
                userId: userId,
                provider: 'google',
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (!tokenRecord) {
            console.error('No Google Tokens found!');
            return;
        }
        console.log('Tokens found.');

        // 2. Initialize Client
        const client = new GoogleAdsApi({
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        });

        // 3. List Customers
        console.log('Listing accessible customers...');
        const response = await client.listAccessibleCustomers(tokenRecord.accessToken);
        // console.log('Response:', JSON.stringify(response, null, 2));

        const resourceNames = (response as any).resource_names || [];
        if (resourceNames.length === 0) {
            console.log('No accessible customers found.');
        } else {
            console.log(`Found ${resourceNames.length} accounts.`);

            // 4. Try Query on first account
            const firstAccount = resourceNames[0].split('/')[1];
            console.log(`Trying query on account: ${firstAccount}`);

            const customer = client.Customer({
                customer_id: firstAccount,
                refresh_token: tokenRecord.refreshToken || '',
                login_customer_id: firstAccount,
            });

            try {
                const gaql = `SELECT campaign.id, campaign.name FROM campaign LIMIT 5`;
                const rows = await customer.query(gaql);
                console.log(`Query success! Found ${rows.length} campaigns.`);
                rows.forEach((r: any) => console.log(`- ${r.campaign.name} (${r.campaign.id})`));
            } catch (queryErr: any) {
                console.error('Query failed:', queryErr.message);
                if (queryErr.message.includes('NOT_ADS_USER')) {
                    console.log('Use might not be an admin on this account, or Manager ID is needed.');
                }
            }
        }

    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
