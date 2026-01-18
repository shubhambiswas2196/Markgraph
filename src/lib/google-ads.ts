import { GoogleAdsApi } from 'google-ads-api';
import prisma from '@/lib/prisma';
// Load credentials from SyncMaster.json - handle both 'web' and 'installed' formats
import credentialsFile from '../../SyncMaster.json';
const credentials = (credentialsFile as any).web || (credentialsFile as any).installed;

export async function getGoogleAdsClient() {
    return new GoogleAdsApi({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    });
}

export async function getUserTokens(userId: string | number) {
    const tokenRecord = await (prisma as any).oAuthToken.findFirst({
        where: {
            userId: typeof userId === 'string' ? parseInt(userId) : userId,
            provider: 'google',
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    if (!tokenRecord) {
        throw new Error('No OAuth tokens found');
    }

    return {
        accessToken: tokenRecord.accessToken,
        refreshToken: tokenRecord.refreshToken,
        expiresAt: tokenRecord.expiresAt,
    };
}
