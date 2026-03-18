/**
 * Cloudflare Pages Function — /api/tts  (POST)
 * Calls ElevenLabs server-side — no CORS, works on free tier.
 */

const EL_KEY   = '4b2d3d697fbd636d824c61cbb39c6d13d472760f31a010ffb195a6e12fedd6c4';
const EL_VOICE = 'P7FvTlcy0R7Ek59pWvnW';

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
    const body = await context.request.json();
    const text = body.text?.trim();
    if (!text) {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key':   EL_KEY,
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability:        0.40,
          similarity_boost: 0.80,
          style:            0.30,
          use_speaker_boost: true,
        },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('ElevenLabs error:', r.status, err);
      return new Response(JSON.stringify({ error: `ElevenLabs ${r.status}`, detail: err.slice(0, 300) }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const audio = await r.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type':  'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });

  } catch (e) {
    console.error('TTS function error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
