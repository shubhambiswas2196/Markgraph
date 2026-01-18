import prisma from './prisma';

/**
 * Fetches the user's AI configuration (API key and model)
 * Falls back to environment variables if not configured
 */
export async function getUserAiConfig(userId: number) {
    try {
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

        // Fetch Model preference
        const modelPref = await prisma.userPreference.findUnique({
            where: {
                userId_category_key: {
                    userId,
                    category: 'ai_config',
                    key: 'selected_model'
                }
            }
        });

        // Check if the stored model is the broken Qwen one, and override if so
        let selectedModel = modelPref?.value || 'xiaomi/mimo-v2-flash:free';
        if (selectedModel.includes('qwen')) {
            // Silently override Qwen to Xiaomi
            selectedModel = 'xiaomi/mimo-v2-flash:free';
        }

        return {
            apiKey: apiKeyPref?.value || process.env.OPENAI_API_KEY,
            model: selectedModel,
            baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1'
        };
    } catch (error) {
        console.error('Error fetching user AI config:', error);
        // Fallback to environment variables
        return {
            apiKey: process.env.OPENAI_API_KEY,
            model: 'xiaomi/mimo-v2-flash:free',
            baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1'
        };
    }
}
