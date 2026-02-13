import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Load credentials from SyncMaster.json - handle both 'web' and 'installed' formats
import credentialsFile from '../../../../../../SyncMaster.json';
import type { SyncMasterConfig } from '@/types/syncmaster';

const typedCredentials = credentialsFile as SyncMasterConfig;
const credentials = typedCredentials.web || typedCredentials.installed;

if (!credentials) {
    throw new Error('Invalid SyncMaster.json configuration: missing web or installed credentials');
}

export async function GET(request: NextRequest) {
    try {
        console.log('OAuth callback started');
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // userId or 'login'

        console.log('Code:', code ? 'present' : 'missing');
        console.log('State:', state);

        if (!code || !state) {
            console.log('Missing code or state');
            return NextResponse.redirect(new URL('/sources?error=auth_failed', request.url));
        }

        // Check if we are in login mode
        const isLoginMode = state === 'login';
        let userId: number | null = null;

        if (!isLoginMode) {
            userId = parseInt(state);
            if (isNaN(userId)) {
                console.log('Invalid userId:', state);
                return NextResponse.redirect(new URL('/sources?error=invalid_user', request.url));
            }
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
        const userName = userInfo.data.name || 'Google User';

        console.log('User info:', { email: userEmail, name: userName });

        if (!userEmail) {
            throw new Error('Google account has no email address');
        }

        // Logic for Login Mode
        if (isLoginMode) {
            console.log('Handling Login Mode');

            // Find or create the user
            let user = await prisma.user.findUnique({
                where: { email: userEmail }
            });

            if (!user) {
                console.log('User not found, creating new user for:', userEmail);
                const [firstName, ...lastNameParts] = userName.split(' ');
                user = await prisma.user.create({
                    data: {
                        email: userEmail,
                        firstName: firstName || 'Google',
                        lastName: lastNameParts.join(' ') || 'User',
                        password: '', // No password for OAuth users
                    }
                });
            } else {
                console.log('User found:', user.id);
            }

            userId = user.id;

            // Generate JWT
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Set the cookie
            // We can't set cookies on NextResponse.redirect easily in a way that respects Next.js middleware sometimes, 
            // but we can make a response object and return it.
            const response = NextResponse.redirect(new URL('/romeo-charge', request.url));
            response.cookies.set('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 7 days
                path: '/',
            });

            // SAVE TOKENS for this user too (so ads/sheets work)
            console.log('Storing OAuth tokens for logged in user...');
            await prisma.oAuthToken.upsert({
                where: {
                    userId_provider_email: {
                        userId: user.id,
                        provider: 'google',
                        email: userEmail,
                    },
                },
                update: {
                    accessToken: tokens.access_token!,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt: new Date(tokens.expiry_date!),
                    updatedAt: new Date(),
                },
                create: {
                    userId: user.id,
                    provider: 'google',
                    accessToken: tokens.access_token!,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt: new Date(tokens.expiry_date!),
                    email: userEmail,
                },
            });

            return response;
        }

        // Logic for Link Mode (Existing logic)
        // Verify user exists before storing tokens
        console.log('Verifying user exists (Link Mode)...');
        const user = await prisma.user.findUnique({
            where: { id: userId! }
        });

        if (!user) {
            console.error('User not found:', userId);
            return NextResponse.redirect(new URL('/sources?error=user_not_found', request.url));
        }

        console.log('User verified, storing tokens in database...');
        // Store tokens in database
        await prisma.oAuthToken.upsert({
            where: {
                userId_provider_email: {
                    userId: userId!,
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
                userId: userId!,
                provider: 'google',
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token || null,
                expiresAt: new Date(tokens.expiry_date!),
                email: userEmail || null,
            },
        });

        console.log('Tokens stored successfully, redirecting to success page');
        // Redirect to success page
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
