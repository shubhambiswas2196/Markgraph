import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { storeMetaTokens, getUserMetaTokens } from '@/lib/meta-oauth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);

        const tokenRecord = await (prisma as any).oAuthToken.findFirst({
            where: {
                userId,
                provider: 'meta',
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (!tokenRecord) {
            return NextResponse.json({ exists: false });
        }

        // Return token existence and expiry, but mask the token itself for security
        return NextResponse.json({
            exists: true,
            expiresAt: tokenRecord.expiresAt,
            updatedAt: tokenRecord.updatedAt,
            // Mask the token: show only first 4 and last 4 chars
            maskedToken: `${tokenRecord.accessToken.substring(0, 6)}...${tokenRecord.accessToken.substring(tokenRecord.accessToken.length - 6)}`
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const { accessToken } = await request.json();

        if (!accessToken) {
            return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
        }

        // We assume manually entered tokens are long-lived or at least have a default 60-day expiry
        // consistent with storeMetaTokens default.
        const DEFAULT_EXPIRES_IN = 5184000; // 60 days

        await storeMetaTokens(userId, accessToken, DEFAULT_EXPIRES_IN, 'manual-update');

        return NextResponse.json({ success: true, message: 'Meta access token updated successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
