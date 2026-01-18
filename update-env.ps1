# Update .env.local with OpenRouter configuration
$envPath = ".env.local"
$newKey = "OPENAI_API_KEY=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"
$baseUrl = "OPENAI_BASE_URL=https://openrouter.ai/api/v1"

# Read existing content
$content = Get-Content $envPath -ErrorAction SilentlyContinue

# Filter out old OPENAI_API_KEY and OPENAI_BASE_URL lines
$newContent = $content | Where-Object { $_ -notmatch "^OPENAI_API_KEY=" -and $_ -notmatch "^OPENAI_BASE_URL=" }

# Add new configuration
$newContent += $newKey
$newContent += $baseUrl

# Write back to file
$newContent | Set-Content $envPath

Write-Host "✅ Updated .env.local with OpenRouter configuration"
Write-Host "Please restart your dev server (Ctrl+C, then npm run dev)"
