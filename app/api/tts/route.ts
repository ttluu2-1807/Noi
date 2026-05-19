import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { synthesizeSpeech, voiceFor } from "@/lib/elevenlabs";
import type { Language } from "@/lib/language-detect";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// ElevenLabs first-byte is usually <1s; full audio for a 500-char
// response is ~3s. Keep maxDuration generous to absorb slow cold starts.
export const maxDuration = 30;

const MAX_CHARS = 5000;

interface TtsRequest {
  text: string;
  /**
   * Drives voice selection. vi → Ngan (Vietnamese native), en →
   * Alexandra (American English). Defaults to vi if omitted —
   * Vietnamese is the parent's primary use case.
   */
  language?: Language;
}

/**
 * Text-to-speech endpoint backed by ElevenLabs, with a Supabase Storage
 * cache. Same text + same voice = same MP3, served from cache forever.
 *
 * Flow:
 *   1. Auth check — only signed-in users can hit this (also rate-limits
 *      anonymous abuse since you need a session).
 *   2. Compute a SHA-256 cache key from (voice_id + model_id + text).
 *      Voice / model changes invalidate the cache automatically.
 *   3. Try to download from the tts-cache bucket via service role.
 *   4. Hit → return cached MP3 with X-Cache: HIT.
 *   5. Miss → call ElevenLabs, upload to cache (best-effort, no retry),
 *      return MP3 with X-Cache: MISS.
 *
 * Server-side caching means a popular AI response — like a Medicare
 * card answer that both the parent and the child tap "Nghe" on — only
 * pays for one ElevenLabs call ever, regardless of how many times it's
 * replayed.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TtsRequest;
  try {
    body = (await request.json()) as TtsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_CHARS} chars)` },
      { status: 400 },
    );
  }

  const language: Language = body.language === "en" ? "en" : "vi";
  const { voiceId, modelId } = voiceFor(language);
  // Cache key includes voice + model so the vi and en caches stay
  // separate, and any future voice swap auto-invalidates the cache.
  const cacheKey =
    createHash("sha256")
      .update(`${voiceId}|${modelId}|${text}`)
      .digest("hex") + ".mp3";

  const admin = createServiceRoleClient();

  // --- Cache lookup ---------------------------------------------------
  const { data: cached } = await admin.storage
    .from("tts-cache")
    .download(cacheKey);

  if (cached) {
    const buffer = await cached.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        // Long client cache too — same URL always returns the same MP3.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "HIT",
      },
    });
  }

  // --- Cache miss: call ElevenLabs ------------------------------------
  let mp3: ArrayBuffer;
  try {
    mp3 = await synthesizeSpeech(text, language);
  } catch (err) {
    console.error("[api/tts] ElevenLabs failed:", err);
    return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
  }

  // Upload to cache — best effort. If it fails (race, network), we
  // still serve the audio. Next request just hits the API again.
  admin.storage
    .from("tts-cache")
    .upload(cacheKey, Buffer.from(mp3), {
      contentType: "audio/mpeg",
      // Don't overwrite if another request beat us to it.
      upsert: false,
    })
    .catch(() => {
      /* swallow — the user already got their audio */
    });

  return new Response(mp3, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Cache": "MISS",
    },
  });
}
