

async function testOpenRouter() {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer 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`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "MetricGraph Test"
        },
        body: JSON.stringify({
            "model": "mistralai/mistral-7b-instruct:free",
            "messages": [
                { "role": "user", "content": "Hello" }
            ]
        })
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

testOpenRouter();
