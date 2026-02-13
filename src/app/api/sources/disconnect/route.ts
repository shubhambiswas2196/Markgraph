import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        // Extract userId from JWT token instead of request body
        const userId = await getUserIdFromRequest(request);

        const { accountId, accountIds, googleEmail } = await request.json();

        if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
            // Bulk granular deletion
            await prisma.dataSource.deleteMany({
                where: {
                    userId: userId,
                    accountId: { in: accountIds },
                    googleEmail: googleEmail !== undefined ? googleEmail : undefined
                }
            });
            return NextResponse.json({ success: true, message: `Successfully disconnected ${accountIds.length} accounts` });
        } else if (accountId) {
            // Single granular deletion
            await prisma.dataSource.deleteMany({
                where: {
                    userId: userId,
                    accountId: accountId,
                    googleEmail: googleEmail !== undefined ? (googleEmail || '') : undefined
                }
            });
            return NextResponse.json({ success: true, message: `Successfully disconnected account ${accountId}` });
        } else {
            // Legacy/Full disconnect: Delete OAuth tokens and all sources for Google
            await prisma.oAuthToken.deleteMany({
                where: {
                    userId: userId,
                    provider: 'google'
                }
            });

            await prisma.dataSource.deleteMany({
                where: {
                    userId: userId,
                    sourceType: 'google-ads'
                }
            });

            return NextResponse.json({ success: true, message: 'Successfully disconnected all Google Ads accounts' });
        }
    } catch (error) {
        console.error('Disconnect error:', error);

        // Return 401 for authentication errors
        if (error instanceof Error && (error.message === 'Not authenticated' || error.message === 'Invalid token')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }
}
