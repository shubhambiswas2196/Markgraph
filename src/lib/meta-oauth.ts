import prisma from '@/lib/prisma';

const META_API_VERSION = 'v22.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaOAuthConfig {
    appId: string;
    appSecret: string;
    redirectUri: string;
}

/**
 * Get Meta OAuth configuration from environment variables
 */
export function getMetaOAuthConfig(redirectUri: string): MetaOAuthConfig {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error('Meta OAuth credentials not configured. Please set META_APP_ID and META_APP_SECRET in environment variables.');
    }

    return {
        appId,
        appSecret,
        redirectUri,
    };
}

/**
 * Generate Meta OAuth authorization URL
 */
export function generateMetaAuthUrl(config: MetaOAuthConfig, state: string): string {
    const params = new URLSearchParams({
        client_id: config.appId,
        redirect_uri: config.redirectUri,
        state,
        scope: 'ads_read,ads_management,business_management',
    });

    return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
    config: MetaOAuthConfig,
    code: string
): Promise<{ accessToken: string; expiresIn: number }> {
    const params = new URLSearchParams({
        client_id: config.appId,
        client_secret: config.appSecret,
        redirect_uri: config.redirectUri,
        code,
    });

    const response = await fetch(
        `${META_BASE_URL}/oauth/access_token?${params.toString()}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Meta OAuth error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in || 5184000, // Default 60 days
    };
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function getLongLivedToken(
    appId: string,
    appSecret: string,
    shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
    const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
        `${META_BASE_URL}/oauth/access_token?${params.toString()}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Meta token exchange error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in || 5184000,
    };
}

/**
 * Retrieve Meta OAuth tokens for a user from the database
 */
export async function getUserMetaTokens(userId: string | number) {
    const tokenRecord = await prisma.oAuthToken.findFirst({
        where: {
            userId: typeof userId === 'string' ? parseInt(userId) : userId,
            provider: 'meta',
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    if (!tokenRecord) {
        // Fallback to environment variable if provided
        if (process.env.META_ACCESS_TOKEN) {
            console.warn('[Meta OAuth] Using fallback META_ACCESS_TOKEN from environment.');
            return {
                accessToken: process.env.META_ACCESS_TOKEN,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Assumed long validity
            };
        }

        throw new Error('No Meta OAuth tokens found. Please go to Settings and enter your Meta Access Token.');
    }

    // Check if token is expired or about to expire (within 1 day)
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expiresAt);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (expiresAt < oneDayFromNow) {
        console.warn('[Meta OAuth] Token expired or expiring soon. Manual refresh required.');
        // Note: Meta doesn't support refresh tokens like Google OAuth
        // Users will need to re-authenticate through OAuth flow
    }

    return {
        accessToken: tokenRecord.accessToken,
        expiresAt: tokenRecord.expiresAt,
    };
}

/**
 * Store or update Meta OAuth tokens in the database
 */
export async function storeMetaTokens(
    userId: number,
    accessToken: string,
    expiresIn: number,
    email?: string
) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.oAuthToken.upsert({
        where: {
            userId_provider_email: {
                userId,
                provider: 'meta',
                email: email || null,
            },
        },
        update: {
            accessToken,
            expiresAt,
            updatedAt: new Date(),
        },
        create: {
            userId,
            provider: 'meta',
            accessToken,
            refreshToken: null, // Meta doesn't use refresh tokens
            expiresAt,
            email: email || null,
        },
    });
}

/**
 * Verify Meta access token is valid
 */
export async function verifyMetaToken(accessToken: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${META_BASE_URL}/me?access_token=${accessToken}`
        );
        return response.ok;
    } catch (error) {
        return false;
    }
}
