/**
 * ElevenLabs text-to-speech wrapper. Server-side only — the API key is
 * in process.env.ELEVENLABS_API_KEY (never NEXT_PUBLIC_).
 *
 * We use a single multilingual voice for both Vietnamese and English so
 * Noi has a consistent identity. "Sarah" was picked for being warm,
 * female, and one of the better multilingual voices in ElevenLabs'
 * shared library — including reasonable Vietnamese tones.
 *
 * Model: eleven_multilingual_v2 — stable, supports Vietnamese, ~600ms
 * first-byte latency. v3 exists but isn't always GA on free tier.
 *
 * If you want to swap voices later, change NOI_VOICE_ID. The cache is
 * keyed on (voice_id + text) so changing the voice invalidates the
 * cache automatically — old MP3s sit in storage until they age out.
 */

const ENDPOINT = "https://api.elevenlabs.io/v1";

/** Sarah — warm female multilingual voice from the shared library. */
export const NOI_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/** Model that handles Vietnamese tones reasonably well. */
export const NOI_MODEL_ID = "eleven_multilingual_v2";

/**
 * Synthesize text to MP3 audio. Returns the raw MP3 bytes.
 * Throws if the API call fails — caller should fall back to browser TTS.
 */
export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const res = await fetch(
    `${ENDPOINT}/text-to-speech/${NOI_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: NOI_MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          // style: 0.0 → most natural / least dramatic
          // use_speaker_boost: true → louder, clearer
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }

  return await res.arrayBuffer();
}
