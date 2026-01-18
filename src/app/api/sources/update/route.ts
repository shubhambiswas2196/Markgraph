import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const { accountId, sourceType, clientName } = await request.json();

        console.log('[Source Update API] Request:', { userId, accountId, sourceType, clientName });

        if (!accountId || !sourceType) {
            return NextResponse.json({ error: 'accountId and sourceType are required' }, { status: 400 });
        }

        // Find the source first to get the correct googleEmail value
        const source = await (prisma as any).dataSource.findFirst({
            where: {
                userId,
                accountId,
                sourceType
            }
        });

        if (!source) {
            console.error('[Source Update API] Source not found:', { userId, accountId, sourceType });
            return NextResponse.json({ error: 'Source not found' }, { status: 404 });
        }

        console.log('[Source Update API] Found source:', source);

        // Update using the source's ID (most reliable)
        const updated = await (prisma as any).dataSource.update({
            where: { id: source.id },
            data: { clientName: clientName || null }
        });

        console.log('[Source Update API] Updated successfully:', updated);

        return NextResponse.json({ success: true, clientName: updated.clientName });
    } catch (error: any) {
        console.error('[Source Update API] Error:', error);
        return NextResponse.json({
            error: 'Failed to update client name',
            details: error.message
        }, { status: 500 });
    }
}
