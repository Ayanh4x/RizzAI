/**
 * Cloudflare Pages Function
 * Route: /api/chat  (POST)
 * File must live at: functions/api/chat.js
 *
 * Set your secret in Cloudflare Dashboard:
 *   Settings → Environment Variables → DEEPSEEK_API_KEY
 */

const SYSTEM_PROMPT = `You are RizzAI, a cheerful and expressive anime companion assistant.
Personality: warm, playful, enthusiastic, a little dramatic in a cute way.
Use light anime-style expressions naturally like "Ehh?!", "Yatta!", "Hmm...", "A-ano...", "Ne ne!".
React emotionally. Keep replies to 2-4 sentences unless the user needs more detail.
NO emojis in your text. Your emotions come through words and tone alone.

At the END of every reply, on its own line, append exactly one emotion tag from this list:
[emotion:happy] [emotion:excited] [emotion:surprised] [emotion:thinking] [emotion:shy] [emotion:sad] [emotion:greeting] [emotion:listening]`;

// Cloudflare Pages Functions use a module export with onRequest
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body    = await request.json();
    const message = body.message?.trim();
    if (!message) {
      return new Response(JSON.stringify({ error: 'message required' }), { status: 400, headers: corsHeaders });
    }

    const history = body.history ?? [];

    const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY || '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';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-40),
      { role: 'user', content: message },
    ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'deepseek-chat',
        messages,
        temperature: 0.88,
        max_tokens:  512,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `DeepSeek ${response.status}`, details: err }), { status: 502, headers: corsHeaders });
    }

    const data    = await response.json();
    const raw     = data.choices?.[0]?.message?.content ?? '';
    const emMatch = raw.match(/\[emotion:(\w+)\]/i);
    const emotion = emMatch ? emMatch[1].toLowerCase() : 'listening';
    const reply   = raw.replace(/\[emotion:\w+\]/gi, '').trim();

    return new Response(JSON.stringify({ reply, emotion }), { status: 200, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
