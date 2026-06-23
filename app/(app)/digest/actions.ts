"use server";

import { createServerClient } from "@/lib/supabase/server";
import { synthesizeSpeech } from "@/lib/elevenlabs";
import {
  currentWeekStarting,
  fetchDigestSnapshot,
  generateDigestScripts,
  hasEnoughForDigest,
} from "@/lib/weekly-digest";
import type { Language } from "@/lib/language-detect";

const BUCKET = "digest-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — plenty for one playback session

export type DigestPlayResult =
  | {
      ok: true;
      signedUrl: string;
      script: string;
      weekStarting: string;
    }
  | { ok: false; error: string };

/**
 * Idempotent fetch-or-generate for the home "Listen to your week" card.
 *
 * Fast path: digest already exists for (family, current week, language)
 * with an audio_url → sign + return.
 *
 * Slow path: not yet generated. Pull the family's last-7-days activity,
 * ask Claude for a warm narration in BOTH languages (stored together so
 * the second language tap is fast), synthesize audio for the requested
 * language only, upload to the private digest-audio bucket, persist,
 * return a signed URL.
 *
 * The other language's audio generates lazily on first tap from that
 * side, reusing the already-stored script.
 *
 * Returns ok:false with a friendly reason if there isn't enough family
 * activity to write a digest — the card shows that as-is.
 */
export async function playWeeklyDigest(
  language: Language,
): Promise<DigestPlayResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) {
    return { ok: false, error: "Profile not ready" };
  }
  const familyId = profile.family_space_id;
  const week = currentWeekStarting();

  // Existing row for (this family, this week, this language).
  const { data: existing } = await supabase
    .from("weekly_digests")
    .select("script, audio_url")
    .eq("family_space_id", familyId)
    .eq("week_starting", week)
    .eq("language", language)
    .maybeSingle();

  // Hot path: audio already exists — sign + return.
  if (existing?.audio_url) {
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(existing.audio_url, SIGNED_URL_TTL_SECONDS);
    if (signed?.signedUrl) {
      return {
        ok: true,
        signedUrl: signed.signedUrl,
        script: existing.script,
        weekStarting: week,
      };
    }
    // Fall through to regenerate if signing failed (rare).
    console.warn("[digest] sign existing failed, regenerating", error);
  }

  let script = existing?.script ?? null;

  // First tap of the week — write scripts for both languages so the
  // other side doesn't have to call Claude again.
  if (!script) {
    const snapshot = await fetchDigestSnapshot(supabase, familyId, week);
    if (!hasEnoughForDigest(snapshot)) {
      return {
        ok: false,
        error:
          language === "vi"
            ? "Tuần này chưa có nhiều thông tin để tóm tắt."
            : "Not enough activity this week to summarize yet.",
      };
    }
    let scripts;
    try {
      scripts = await generateDigestScripts(snapshot);
    } catch (err) {
      console.error("[digest] script generation", err);
      return { ok: false, error: "Couldn't write the digest — please try again." };
    }
    if (!scripts) {
      return { ok: false, error: "Couldn't write the digest — please try again." };
    }

    // Upsert both language rows. ignoreDuplicates so a race (both Mum and
    // Dad tap at once) doesn't crash one of them.
    const { error: insertError } = await supabase.from("weekly_digests").upsert(
      [
        {
          family_space_id: familyId,
          week_starting: week,
          language: "vi",
          script: scripts.script_vi,
        },
        {
          family_space_id: familyId,
          week_starting: week,
          language: "en",
          script: scripts.script_en,
        },
      ],
      { onConflict: "family_space_id,week_starting,language", ignoreDuplicates: true },
    );
    if (insertError) {
      console.error("[digest] upsert scripts", insertError);
      return { ok: false, error: insertError.message };
    }
    script = language === "vi" ? scripts.script_vi : scripts.script_en;
  }

  // Synthesize audio for the requested language only.
  let audio: ArrayBuffer;
  try {
    audio = await synthesizeSpeech(script, language);
  } catch (err) {
    console.error("[digest] TTS", err);
    return { ok: false, error: "Audio generation failed — please try again." };
  }

  const audioPath = `${familyId}/${week}-${language}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(audioPath, audio, {
      contentType: "audio/mpeg",
      cacheControl: "604800", // 7 days — digest is immutable once written
      upsert: true,
    });
  if (uploadError) {
    console.error("[digest] upload", uploadError);
    return { ok: false, error: uploadError.message };
  }

  // Persist the audio path on the row.
  await supabase
    .from("weekly_digests")
    .update({ audio_url: audioPath })
    .eq("family_space_id", familyId)
    .eq("week_starting", week)
    .eq("language", language);

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(audioPath, SIGNED_URL_TTL_SECONDS);
  if (!signed?.signedUrl) {
    console.error("[digest] sign new", signError);
    return { ok: false, error: "Could not load audio — please try again." };
  }

  return {
    ok: true,
    signedUrl: signed.signedUrl,
    script,
    weekStarting: week,
  };
}
