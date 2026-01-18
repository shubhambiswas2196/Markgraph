import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthentication } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET - Fetch current AI configuration
export async function GET(req: NextRequest) {
    try {
        const payload = await verifyAuthentication(req);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = payload.userId;

        // Fetch API key preference
        const apiKeyPref = await prisma.userPreference.findUnique({
            where: {
                userId_category_key: {
                    userId,
                    category: 'ai_config',
                    key: 'openrouter_api_key'
                }
            }
        });

        // Fetch model preference
        const modelPref = await prisma.userPreference.findUnique({
            where: {
                userId_category_key: {
                    userId,
                    category: 'ai_config',
                    key: 'selected_model'
                }
            }
        });

        return NextResponse.json({
            exists: !!apiKeyPref,
            maskedKey: apiKeyPref ? `${apiKeyPref.value.slice(0, 10)}...${apiKeyPref.value.slice(-4)}` : null,
            selectedModel: modelPref?.value || 'xiaomi/mimo-v2-flash:free',
            updatedAt: apiKeyPref?.updatedAt || null
        });

    } catch (error) {
        console.error('Error fetching AI config:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Save AI configuration
export async function POST(req: NextRequest) {
    try {
        const payload = await verifyAuthentication(req);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = payload.userId;
        const body = await req.json();
        const { apiKey, selectedModel } = body;

        // Update API key if provided
        if (apiKey) {
            await prisma.userPreference.upsert({
                where: {
                    userId_category_key: {
                        userId,
                        category: 'ai_config',
                        key: 'openrouter_api_key'
                    }
                },
                update: {
                    value: apiKey,
                    confidence: 1.0,
                    source: 'user_input'
                },
                create: {
                    userId,
                    category: 'ai_config',
                    key: 'openrouter_api_key',
                    value: apiKey,
                    confidence: 1.0,
                    source: 'user_input'
                }
            });
        }

        // Update selected model if provided
        if (selectedModel) {
            await prisma.userPreference.upsert({
                where: {
                    userId_category_key: {
                        userId,
                        category: 'ai_config',
                        key: 'selected_model'
                    }
                },
                update: {
                    value: selectedModel,
                    confidence: 1.0,
                    source: 'user_input'
                },
                create: {
                    userId,
                    category: 'ai_config',
                    key: 'selected_model',
                    value: selectedModel,
                    confidence: 1.0,
                    source: 'user_input'
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'AI configuration updated successfully'
        });

    } catch (error) {
        console.error('Error saving AI config:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
