import type { Language } from "./language-detect";

/**
 * ElevenLabs text-to-speech wrapper. Server-side only — the API key is
 * in process.env.ELEVENLABS_API_KEY (never NEXT_PUBLIC_).
 *
 * One voice per language, picked at call time:
 *
 *   - vi → Ngan (Vietnamese-native, central accent, professional voice).
 *          Best with eleven_turbo_v2_5 per ElevenLabs' voice metadata.
 *   - en → Alexandra (American English, conversational professional).
 *          Best with eleven_multilingual_v2.
 *
 * Why per-language: a Vietnamese voice butchers English (heavy
 * reading-accent) and a multilingual English voice loses tone accuracy
 * in Vietnamese. Native voices for each side give the best fidelity
 * for the audience that hears each language.
 *
 * Cache key is composed of voice_id + model_id + text, so swapping
 * either constant invalidates the cache automatically — no manual
 * cache purge required when changing voices.
 */

const ENDPOINT = "https://api.elevenlabs.io/v1";

interface VoiceConfig {
  voiceId: string;
  modelId: string;
}

const VOICES: Record<Language, VoiceConfig> = {
  vi: {
    voiceId: "a3AkyqGG4v8Pg7SWQ0Y3", // Ngan — VI native, central accent
    modelId: "eleven_turbo_v2_5",
  },
  en: {
    voiceId: "kdmDKE6EkgrWrrykO9Qt", // Alexandra — EN American, conversational
    modelId: "eleven_multilingual_v2",
  },
};

/** Get the voice config used for the given language. */
export function voiceFor(language: Language): VoiceConfig {
  return VOICES[language];
}

/**
 * Synthesize text to MP3 audio using the language's configured voice.
 * Returns raw MP3 bytes. Throws if the API call fails — caller should
 * fall back to browser TTS.
 */
export async function synthesizeSpeech(
  text: string,
  language: Language,
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }
  const { voiceId, modelId } = VOICES[language];

  const res = await fetch(
    `${ENDPOINT}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          // style: 0 = most natural / least dramatic
          // use_speaker_boost: louder, clearer for elderly listeners
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
