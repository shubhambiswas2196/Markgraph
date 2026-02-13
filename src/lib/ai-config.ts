import prisma from './prisma';

/**
 * Fetches the user's AI configuration (API key and model)
 * Falls back to environment variables if not configured
 */
export async function getUserAiConfig(userId: number) {
    try {
        const model = 'x-ai/grok-4.1-fast';

        // Fetch API Key preference
        const apiKeyPref = await prisma.userPreference.findUnique({
            where: {
                userId_category_key: {
                    userId,
                    category: 'ai_config',
                    key: 'openrouter_api_key'
                }
            }
        });

        const apiKey = apiKeyPref?.value || process.env.OPENAI_API_KEY || "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";
        const baseURL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';

        if (!apiKey) {
            return {
                isValid: false,
                errorMessage: "No AI API keys configured. Please go to Settings to add your OpenRouter API key so I can assist you.",
                apiKey: '',
                model,
                baseURL
            };
        }

        return {
            isValid: true,
            apiKey: apiKey,
            model,
            baseURL
        };
    } catch (error) {
        console.error('Error fetching user AI config:', error);
        return {
            isValid: !!process.env.OPENAI_API_KEY,
            errorMessage: "Unexpected error fetching your AI configuration. Please check your settings.",
            model: 'x-ai/grok-4.1-fast',
            baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1'
        };
    }
}
