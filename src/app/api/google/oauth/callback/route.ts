import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

// Load credentials from SyncMaster.json - handle both 'web' and 'installed' formats
import credentialsFile from '../../../../../../SyncMaster.json';
const credentials = (credentialsFile as any).web || (credentialsFile as any).installed;

export async function GET(request: NextRequest) {
    try {
        console.log('OAuth callback started');
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // userId

        console.log('Code:', code ? 'present' : 'missing');
        console.log('State:', state);

        if (!code || !state) {
            console.log('Missing code or state');
            return NextResponse.redirect(new URL('/sources?error=auth_failed', request.url));
        }

        const userId = parseInt(state);
        if (isNaN(userId)) {
            console.log('Invalid userId:', state);
            return NextResponse.redirect(new URL('/sources?error=invalid_user', request.url));
        }

        console.log('Creating OAuth2 client with redirect URI:', `${request.nextUrl.origin}/api/google/oauth/callback`);
        const oauth2Client = new google.auth.OAuth2(
            credentials.client_id,
            credentials.client_secret,
            `${request.nextUrl.origin}/api/google/oauth/callback`
        );

        console.log('Exchanging code for tokens...');
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Tokens received:', {
            access_token: tokens.access_token ? 'present' : 'missing',
            refresh_token: tokens.refresh_token ? 'present' : 'missing',
            expiry_date: tokens.expiry_date
        });

        oauth2Client.setCredentials(tokens);

        console.log('Fetching user info to get email...');
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const userEmail = userInfo.data.email;

        console.log('User email:', userEmail);

        // Verify user exists before storing tokens
        console.log('Verifying user exists...');
        const user = await (prisma as any).user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            console.error('User not found:', userId);
            return NextResponse.redirect(new URL('/sources?error=user_not_found', request.url));
        }

        console.log('User verified, storing tokens in database...');
        // Store tokens in database - using email in primary key if possible, 
        // or just treating it as a unique record for this specific email.
        await (prisma as any).oAuthToken.upsert({
            where: {
                userId_provider_email: {
                    userId: userId,
                    provider: 'google',
                    email: userEmail || null,
                },
            },
            update: {
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token || null,
                expiresAt: new Date(tokens.expiry_date!),
                updatedAt: new Date(),
            },
            create: {
                userId: userId,
                provider: 'google',
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token || null,
                expiresAt: new Date(tokens.expiry_date!),
                email: userEmail || null,
            },
        });

        console.log('Tokens stored successfully, redirecting to success page');
        // Redirect to success page which will message the opener
        return NextResponse.redirect(new URL(`/google-success?email=${encodeURIComponent(userEmail || '')}`, request.url));
    } catch (error) {
        console.error('OAuth callback error:', error);
        const err = error as any;
        const errorDetail = err.response?.data?.error || err.message || 'unknown_error';

        // DEBUG: Write error to file
        try {
            const logPath = path.join(process.cwd(), 'auth-debug.log');
            const logData = JSON.stringify({
                timestamp: new Date().toISOString(),
                message: err.message,
                stack: err.stack,
                detail: errorDetail,
                response: err.response?.data
            }, null, 2);
            fs.writeFileSync(logPath, logData);
        } catch (e) {
            console.error('Failed to write auth error log', e);
        }

        console.error('Error details:', {
            message: err.message,
            detail: errorDetail,
            stack: err.stack
        });
        // Redirect with the detail if possible
        return NextResponse.redirect(new URL(`/google-success?error=auth_failed&detail=${encodeURIComponent(errorDetail)}`, request.url));
    }
}
