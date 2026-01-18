import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getMetaOAuthConfig, generateMetaAuthUrl } from '@/lib/meta-oauth';

export async function GET(request: NextRequest) {
    try {
        console.log('[Meta OAuth] Initiation started');

        // Extract userId from JWT token
        const userId = await getUserIdFromRequest(request);

        console.log('[Meta OAuth] UserId:', userId);

        const redirectUri = `${request.nextUrl.origin}/api/meta/oauth/callback`;
        console.log('[Meta OAuth] Using redirect URI:', redirectUri);

        const config = getMetaOAuthConfig(redirectUri);
        const authUrl = generateMetaAuthUrl(config, userId.toString());

        console.log('[Meta OAuth] Auth URL generated, redirecting to Meta...');
        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('[Meta OAuth] Initiation error:', error);

        // Return 401 for authentication errors
        if (error instanceof Error && (error.message === 'Not authenticated' || error.message === 'Invalid token')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        const err = error as Error;
        console.error('[Meta OAuth] Error details:', {
            message: err.message,
            stack: err.stack
        });
        return NextResponse.json({ error: 'Failed to initiate Meta OAuth' }, { status: 500 });
    }
}
