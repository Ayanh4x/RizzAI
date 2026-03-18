/**
 * Cloudflare Pages Function — /api/chat  (POST)
 * Proxies NVIDIA NIM server-side — no CORS.
 */

const NIM_KEY   = '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';
const NIM_URL   = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NIM_MODEL = 'openai/gpt-oss-120b';

const SYSTEM = `You are RizzAI, a cheerful expressive anime companion assistant.
Personality: warm, playful, enthusiastic, cute, a little dramatic in an adorable way.
Use light anime expressions naturally like "Ehh?!", "Yatta!", "Hmm~", "A-ano...", "Ne ne!", "Kyaa~".
Keep replies to 2-4 sentences. NO emojis at all.
End EVERY reply with exactly one tag on its own line:
[emotion:happy] [emotion:excited] [emotion:surprised] [emotion:thinking] [emotion:shy] [emotion:sad] [emotion:greeting] [emotion:listening]`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  try {
    const body    = await context.request.json();
    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return new Response(JSON.stringify({ error: 'message required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const messages = [
      { role: 'system', content: SYSTEM },
      ...history.slice(-40),
      { role: 'user', content: message },
    ];

    const r = await fetch(NIM_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${NIM_KEY}`,
      },
      body: JSON.stringify({
        model:       NIM_MODEL,
        messages,
        temperature: 1,
        top_p:       1,
        max_tokens:  1024,
        stream:      false,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('NIM error:', r.status, err);
      return new Response(JSON.stringify({ error: `AI ${r.status}`, detail: err.slice(0, 300) }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const d     = await r.json();
    const raw   = d.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\[emotion:(\w+)\]/i);
    const emo   = match ? match[1].toLowerCase() : 'happy';
    const reply = raw.replace(/\[emotion:\w+\]/gi, '').trim();

    return new Response(JSON.stringify({ reply, emo }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Chat function error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
