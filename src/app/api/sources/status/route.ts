import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const uid = parseInt(userId);

        // Check for Google OAuth token
        // Check for ANY Google OAuth token
        const token = await (prisma as any).oAuthToken.findFirst({
            where: {
                userId: uid,
                provider: 'google',
            },
        });

        // Get connected data sources
        const sources = await (prisma as any).dataSource.findMany({
            where: {
                userId: uid,
                status: 'active'
            },
            select: {
                accountId: true,
                accountName: true,
                currency: true,
                managerId: true,
                googleEmail: true,
                sourceType: true,
                status: true
            }
        });

        return NextResponse.json({
            isConnected: !!token || (sources && sources.length > 0),
            sources: sources || []
        });
    } catch (error: any) {
        console.error('Status check error:', error);
        try {
            fs.writeFileSync(path.join(process.cwd(), 'server-debug.log'), `[${new Date().toISOString()}] Error in sources/status: ${error.message}\nStack: ${error.stack}\n`, { flag: 'a' });
        } catch (e) { console.error('Failed to write log', e); }
        return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
    }
}
