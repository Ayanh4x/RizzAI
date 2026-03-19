/**
 * Cloudflare Pages Function — /api/chat  (POST)
 * Brain: Google Gemini 2.0 Flash
 */

const GEMINI_KEY = 'AIzaSyAi2kvyiCkwcyEJuT2g4n4N-tdtm19_Z34';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

    if (!message) return err('message required', 400);

    // Build Gemini contents array from history + new message
    const contents = [];

    // Add conversation history
    for (const h of history.slice(-20)) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }

    // Add current user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const r = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: {
          temperature:     1.0,
          topP:            0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!r.ok) {
      const e = await r.text();
      console.error('Gemini error:', r.status, e);
      return err(`Gemini ${r.status}: ${e.slice(0,200)}`, 502);
    }

    const d     = await r.json();
    const raw   = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const match = raw.match(/\[emotion:(\w+)\]/i);
    const emo   = match ? match[1].toLowerCase() : 'happy';
    const reply = raw.replace(/\[emotion:\w+\]/gi, '').trim();

    return new Response(JSON.stringify({ reply, emo }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Function error:', e);
    return err(e.message, 500);
  }
}

function err(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
