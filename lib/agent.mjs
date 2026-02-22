import { neon, tag } from './colors.mjs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

export async function callClaude(systemPrompt, userPrompt) {
  if (!ANTHROPIC_API_KEY) {
    return null; // fallback to templates
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.log(`  ${tag.error} ${neon.yellow('Claude API error:')} ${neon.dim(`HTTP ${res.status}`)}`);
      return null;
    }

    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    console.log(`  ${tag.error} ${neon.yellow('Claude API error:')} ${neon.dim(err.message || 'unknown')}`);
    return null;
  }
}
