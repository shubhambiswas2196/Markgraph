import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, firstName: true }
        });

        const dataSources = await prisma.dataSource.findMany({
            select: {
                id: true,
                userId: true,
                sourceType: true,
                accountName: true,
                accountId: true,
                status: true
            }
        });

        const tokens = await prisma.oAuthToken.findMany({
            select: {
                id: true,
                userId: true,
                provider: true,
                email: true
            }
        });

        return NextResponse.json({
            status: 'ok',
            counts: {
                users: users.length,
                dataSources: dataSources.length,
                tokens: tokens.length
            },
            users,
            dataSources,
            tokens
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
