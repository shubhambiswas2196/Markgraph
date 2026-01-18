import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const body = await request.json();
        const { accounts, googleEmail, sourceType, accountId, accountName, currency, status } = body;

        // Unified handling for both batch (Google) and single (Meta) connection
        const accountsToProcess = accounts || [{
            id: accountId,
            name: accountName,
            currency: currency,
            status: status
        }];
        const platform = sourceType || 'google-ads';

        if (!accountsToProcess || accountsToProcess.length === 0) {
            return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
        }

        console.log(`Connecting ${accountsToProcess.length} accounts for user ${userId}. Platform: ${platform}`);

        for (const account of accountsToProcess) {
            // Meta Ads doesn't use googleEmail, but the DB schema has a unique constraint including it
            // We use empty string for Meta to satisfy the constraint (can't use null in where clause)
            const currentGoogleEmail = platform === 'google-ads' ? (googleEmail || '') : '';

            await (prisma as any).dataSource.upsert({
                where: {
                    userId_sourceType_accountId_googleEmail: {
                        userId: userId,
                        sourceType: platform,
                        accountId: account.id,
                        googleEmail: currentGoogleEmail
                    }
                },
                update: {
                    accountName: account.name,
                    managerId: account.parentId || null,
                    currency: account.currency,
                    status: 'active',
                    updatedAt: new Date(),
                },
                create: {
                    userId: userId,
                    sourceType: platform,
                    accountId: account.id,
                    accountName: account.name,
                    managerId: account.parentId || null,
                    currency: account.currency,
                    googleEmail: currentGoogleEmail,
                    status: 'active',
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: `Successfully connected ${accountsToProcess.length} ${platform} account(s)`
        });
    } catch (error) {
        console.error('Data source connection error:', error);
        return NextResponse.json({
            error: 'Failed to connect data sources',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
