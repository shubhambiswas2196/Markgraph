import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const { userId, accountId, accountIds, googleEmail } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const uid = parseInt(userId);

        if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
            // Bulk granular deletion
            await (prisma as any).dataSource.deleteMany({
                where: {
                    userId: uid,
                    accountId: { in: accountIds },
                    googleEmail: googleEmail !== undefined ? googleEmail : undefined
                }
            });
            return NextResponse.json({ success: true, message: `Successfully disconnected ${accountIds.length} accounts` });
        } else if (accountId) {
            // Single granular deletion
            await (prisma as any).dataSource.deleteMany({
                where: {
                    userId: uid,
                    accountId: accountId,
                    googleEmail: googleEmail !== undefined ? (googleEmail || '') : undefined
                }
            });
            return NextResponse.json({ success: true, message: `Successfully disconnected account ${accountId}` });
        } else {
            // Legacy/Full disconnect: Delete OAuth tokens and all sources for Google
            await (prisma as any).oAuthToken.deleteMany({
                where: {
                    userId: uid,
                    provider: 'google'
                }
            });

            await (prisma as any).dataSource.deleteMany({
                where: {
                    userId: uid,
                    sourceType: 'google-ads'
                }
            });

            return NextResponse.json({ success: true, message: 'Successfully disconnected all Google Ads accounts' });
        }
    } catch (error) {
        console.error('Disconnect error:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }
}
