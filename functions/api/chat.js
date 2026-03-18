/**
 * Cloudflare Pages Function — /api/chat
 * Handles BOTH AI chat AND ElevenLabs TTS server-side.
 * This bypasses CORS issues for both APIs.
 */

const NIM_KEY   = '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';
const NIM_URL   = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NIM_MODEL = 'openai/gpt-oss-120b';

const EL_KEY    = '4b2d3d697fbd636d824c61cbb39c6d13d472760f31a010ffb195a6e12fedd6c4';
const EL_VOICE  = 'P7FvTlcy0R7Ek59pWvnW';

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
  const url = new URL(context.request.url);

  // ── Route: /api/chat ─────────────────────────────────
  if (url.pathname === '/api/chat') {
    try {
      const body    = await context.request.json();
      const message = body.message?.trim();
      const history = Array.isArray(body.history) ? body.history : [];
      if (!message) return json({ error: 'message required' }, 400);

      const messages = [
        { role: 'system', content: SYSTEM },
        ...history.slice(-40),
        { role: 'user', content: message },
      ];

      const r = await fetch(NIM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NIM_KEY}` },
        body: JSON.stringify({ model: NIM_MODEL, messages, temperature: 1, top_p: 1, max_tokens: 1024, stream: false }),
      });

      if (!r.ok) return json({ error: `AI ${r.status}`, detail: (await r.text()).slice(0,300) }, 502);

      const d     = await r.json();
      const raw   = d.choices?.[0]?.message?.content ?? '';
      const match = raw.match(/\[emotion:(\w+)\]/i);
      const emo   = match ? match[1].toLowerCase() : 'happy';
      const reply = raw.replace(/\[emotion:\w+\]/gi, '').trim();

      return json({ reply, emo });

    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // ── Route: /api/tts ──────────────────────────────────
  if (url.pathname === '/api/tts') {
    try {
      const body = await context.request.json();
      const text = body.text?.trim();
      if (!text) return json({ error: 'text required' }, 400);

      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key':   EL_KEY,
          'Accept':       'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.40,
            similarity_boost: 0.80,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('ElevenLabs error:', r.status, errText);
        return json({ error: `ElevenLabs ${r.status}`, detail: errText.slice(0,300) }, 502);
      }

      // Stream the audio back to the browser
      const audioData = await r.arrayBuffer();
      return new Response(audioData, {
        status: 200,
        headers: {
          ...CORS,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      });

    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return json({ error: 'not found' }, 404);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
