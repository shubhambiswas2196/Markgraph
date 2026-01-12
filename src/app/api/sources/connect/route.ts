import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';


export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, accounts, googleEmail } = body;

        if (!userId || !accounts || !Array.isArray(accounts)) {
            return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
        }

        const uid = parseInt(userId);
        console.log(`Connecting ${accounts.length} accounts for user ${uid}. Email: ${googleEmail}`);

        // Create or update data sources
        for (const account of accounts) {
            const source = await (prisma as any).dataSource.upsert({
                where: {
                    userId_sourceType_accountId_googleEmail: {
                        userId: uid,
                        sourceType: 'google-ads',
                        accountId: account.id,
                        googleEmail: googleEmail || '',
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
                    userId: uid,
                    sourceType: 'google-ads',
                    accountId: account.id,
                    accountName: account.name,
                    managerId: account.parentId || null,
                    currency: account.currency,
                    googleEmail: googleEmail || '',
                    status: 'active',
                },
            });


        }

        const dataSources = await (prisma as any).dataSource.findMany({
            where: { userId: uid, sourceType: 'google-ads' }
        });

        return NextResponse.json({
            success: true,
            dataSources,
            message: `Successfully connected ${dataSources.length} Google Ads account(s)`
        });
    } catch (error) {
        console.error('Data source connection error:', error);
        return NextResponse.json({
            error: 'Failed to connect data sources',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
