// AI-powered flash card generation
export async function generateFlashCardsWithAI(userId: number) {
    try {
        // Call the AI to generate insights using its tools
        const response = await fetch('/api/nexus/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                messages: [{
                    role: 'user',
                    content: `Generate 3 brief performance insights for my connected data sources. For each insight:
1. Short title (max 3 words)
2. Data source name
3. One-sentence insight with specific metric

Use get_account_overview and other tools to fetch REAL data. Format as JSON array:
[
  {"title": "Performance Pulse", "source": "My Store", "insight": "Generated 234 clicks today with CPC at $1.45"},
  {"title": "Budget Alert", "source": "My Store", "insight": "85% of daily budget utilized, on track to cap by 6 PM"},
  {"title": "Top Campaign", "source": "My Store", "insight": "Summer Sale leading with 156 clicks and $89 spend"}
]

IMPORTANT: Only return the JSON array, nothing else.`
                }]
            })
        });

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('Failed to parse API response as JSON:', jsonError);
            const text = await response.text();
            console.log('Raw response text:', text);
            return null;
        }

        console.log('AI Response for flash cards:', data);

        if (data.response) {
            try {
                let jsonText = data.response;

                // Remove markdown code blocks if present
                jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

                // Find the first [ and last ]
                const firstBracket = jsonText.indexOf('[');
                const lastBracket = jsonText.lastIndexOf(']');

                if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                    let extracted = jsonText.substring(firstBracket, lastBracket + 1);

                    // Remove problematic whitespace but keep structure
                    extracted = extracted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                    console.log('Extracted JSON (first 200 chars):', extracted.substring(0, 200));

                    const insights = JSON.parse(extracted);
                    console.log('Parsed insights:', insights);
                    return insights;
                }
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.log('Failed to parse response:', data.response);
            }
        }

        return null;
    } catch (error) {
        console.error('Flash card generation error:', error);
        return null;
    }
}
