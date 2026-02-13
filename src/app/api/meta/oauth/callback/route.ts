import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMetaOAuthConfig, exchangeCodeForToken, getLongLivedToken, storeMetaTokens } from '@/lib/meta-oauth';
import { getMetaAdAccounts } from '@/lib/meta-ads';

export async function GET(request: NextRequest) {
    try {
        console.log('[Meta OAuth] Callback started');
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // userId
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
            console.log('[Meta OAuth] Error from Meta:', error);
            return NextResponse.redirect(new URL(`/sources?error=meta_auth_${error}`, request.url));
        }

        console.log('[Meta OAuth] Code:', code ? 'present' : 'missing');
        console.log('[Meta OAuth] State:', state);

        if (!code || !state) {
            console.log('[Meta OAuth] Missing code or state');
            return NextResponse.redirect(new URL('/sources?error=auth_failed', request.url));
        }

        const userId = parseInt(state);
        if (isNaN(userId)) {
            console.log('[Meta OAuth] Invalid userId:', state);
            return NextResponse.redirect(new URL('/sources?error=invalid_user', request.url));
        }

        console.log('[Meta OAuth] Verifying user exists...');
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            console.error('[Meta OAuth] User not found:', userId);
            return NextResponse.redirect(new URL('/sources?error=user_not_found', request.url));
        }

        const redirectUri = `${request.nextUrl.origin}/api/meta/oauth/callback`;
        const config = getMetaOAuthConfig(redirectUri);

        console.log('[Meta OAuth] Exchanging code for tokens...');
        const shortLivedToken = await exchangeCodeForToken(config, code);

        console.log('[Meta OAuth] Exchanging for long-lived token...');
        const longLivedToken = await getLongLivedToken(
            config.appId,
            config.appSecret,
            shortLivedToken.accessToken
        );

        console.log('[Meta OAuth] Tokens received, storing in database...');
        await storeMetaTokens(userId, longLivedToken.accessToken, longLivedToken.expiresIn);

        console.log('[Meta OAuth] Fetching Meta ad accounts...');
        const accounts = await getMetaAdAccounts(longLivedToken.accessToken);

        console.log(`[Meta OAuth] Found ${accounts.length} ad accounts, storing in database...`);
        
        // Store ad accounts in DataSource table
        for (const account of accounts) {
            await prisma.dataSource.upsert({
                where: {
                    userId_sourceType_accountId_googleEmail: {
                        userId: userId,
                        sourceType: 'meta-ads',
                        accountId: account.account_id,
                        googleEmail: null,
                    },
                },
                update: {
                    accountName: account.name,
                    currency: account.currency || 'USD',
                    status: account.account_status === 1 ? 'active' : 'inactive',
                    updatedAt: new Date(),
                },
                create: {
                    userId: userId,
                    sourceType: 'meta-ads',
                    accountId: account.account_id,
                    accountName: account.name,
                    currency: account.currency || 'USD',
                    status: account.account_status === 1 ? 'active' : 'inactive',
                    syncStatus: 'PENDING',
                },
            });
        }

        console.log('[Meta OAuth] Success! Redirecting to sources page...');
        return NextResponse.redirect(new URL('/sources?success=meta_connected', request.url));
    } catch (error) {
        console.error('[Meta OAuth] Callback error:', error);
        const err = error as any;
        const errorDetail = err.response?.data?.error || err.message || 'unknown_error';

        console.error('[Meta OAuth] Error details:', {
            message: err.message,
            detail: errorDetail,
            stack: err.stack
        });

        return NextResponse.redirect(new URL(`/sources?error=meta_auth_failed&detail=${encodeURIComponent(errorDetail)}`, request.url));
    }
}
