import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getUserIdFromRequest } from '@/lib/auth';

// Load credentials from SyncMaster.json - handle both 'web' and 'installed' formats
import credentialsFile from '../../../../../../SyncMaster.json';
const credentials = (credentialsFile as any).web || (credentialsFile as any).installed;

export async function GET(request: NextRequest) {
    try {
        console.log('OAuth initiation started');

        // Extract userId from JWT token instead of query parameter
        const userId = await getUserIdFromRequest(request);

        const { searchParams } = new URL(request.url);
        const isSwitch = searchParams.get('switch') === 'true';

        console.log('UserId:', userId, 'Switch mode:', isSwitch);
        console.log('Credentials loaded:', {
            client_id: credentials.client_id ? 'present' : 'missing',
            client_secret: credentials.client_secret ? 'present' : 'missing',
            redirect_uris: credentials.redirect_uris
        });

        const redirectUri = `${request.nextUrl.origin}/api/google/oauth/callback`;
        console.log('Using redirect URI:', redirectUri);

        const oauth2Client = new google.auth.OAuth2(
            credentials.client_id,
            credentials.client_secret,
            redirectUri
        );

        const scopes = [
            'https://www.googleapis.com/auth/adwords', // Google Ads API
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ];

        console.log('Generating auth URL with scopes:', scopes);
        const authorizationUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: userId.toString(), // Pass user ID in state
            include_granted_scopes: true,
            prompt: isSwitch ? 'select_account' : undefined
        });

        console.log('Auth URL generated, redirecting to:', authorizationUrl.substring(0, 100) + '...');
        return NextResponse.redirect(authorizationUrl);
    } catch (error) {
        console.error('OAuth initiation error:', error);

        // Return 401 for authentication errors
        if (error instanceof Error && (error.message === 'Not authenticated' || error.message === 'Invalid token')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        const err = error as Error;
        console.error('Error details:', {
            message: err.message,
            stack: err.stack
        });
        return NextResponse.json({ error: 'Failed to initiate OAuth' }, { status: 500 });
    }
}
