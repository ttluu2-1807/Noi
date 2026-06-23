import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, MODEL } from "./anthropic";

export interface DigestScripts {
  script_vi: string;
  script_en: string;
}

export interface WeeklyDigestSnapshot {
  /** ISO Monday date (YYYY-MM-DD) marking the start of the digest week. */
  weekStarting: string;
  /** Threads active in the past 7 days, with their latest activity. */
  threads: Array<{
    title: string;
    status: "open" | "resolved";
    initiated_by_role: string | null;
    updated_at: string;
  }>;
  /** Open todos with optional due dates. */
  openTodos: Array<{
    text_en: string;
    text_vi: string;
    due_at: string | null;
  }>;
  /** Diary entries logged in the past 7 days. */
  diaryEntries: Array<{
    kind: "event" | "decision" | "note";
    title_en: string | null;
    title_vi: string | null;
    event_date: string | null;
  }>;
}

/**
 * Compute the Monday (00:00 Australia/Sydney) of the current week as
 * an ISO date string. Used as the cache key for weekly_digests — every
 * day of the week resolves to the same key, so the digest is fresh on
 * Monday and stable for the rest of the week.
 */
export function currentWeekStarting(): string {
  const now = new Date();
  // Convert to Sydney local — getDay() returns 0..6 (Sun=0). Use
  // toLocaleString to get Sydney-local components reliably across hosts.
  const sydney = new Date(
    now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }),
  );
  const day = sydney.getDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(sydney);
  monday.setDate(sydney.getDate() - offsetToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

/**
 * Pull the raw family activity needed to write a digest. Everything
 * is RLS-scoped to the user's family by the supabase client passed in.
 */
export async function fetchDigestSnapshot(
  supabase: SupabaseClient,
  familySpaceId: string,
  weekStarting: string,
): Promise<WeeklyDigestSnapshot> {
  // Week window: 7 days back from week start (so a digest for week
  // beginning Mon 2026-06-22 summarizes Mon 2026-06-15 → Sun 2026-06-21).
  const weekEnd = new Date(weekStarting);
  const weekBegin = new Date(weekStarting);
  weekBegin.setDate(weekBegin.getDate() - 7);

  const [threadsResult, todosResult, diaryResult] = await Promise.all([
    supabase
      .from("threads")
      .select("title_en, title_vi, status, initiated_by_role, updated_at")
      .eq("family_space_id", familySpaceId)
      .is("deleted_at", null)
      .gte("updated_at", weekBegin.toISOString())
      .lte("updated_at", weekEnd.toISOString())
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("family_todos")
      .select("text_en, text_vi, due_at")
      .eq("family_space_id", familySpaceId)
      .eq("is_completed", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("diary_entries")
      .select("kind, title_en, title_vi, event_date, created_at")
      .eq("family_space_id", familySpaceId)
      .is("deleted_at", null)
      .gte("created_at", weekBegin.toISOString())
      .lte("created_at", weekEnd.toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    weekStarting,
    threads: (threadsResult.data ?? []).map((t) => ({
      title: (t.title_en ?? t.title_vi ?? "Untitled") as string,
      status: t.status === "resolved" ? "resolved" : "open",
      initiated_by_role: (t.initiated_by_role ?? null) as string | null,
      updated_at: t.updated_at as string,
    })),
    openTodos: (todosResult.data ?? []).map((r) => ({
      text_en: (r.text_en ?? "") as string,
      text_vi: (r.text_vi ?? "") as string,
      due_at: (r.due_at ?? null) as string | null,
    })),
    diaryEntries: (diaryResult.data ?? []).map((r) => ({
      kind: (r.kind ?? "note") as "event" | "decision" | "note",
      title_en: (r.title_en ?? null) as string | null,
      title_vi: (r.title_vi ?? null) as string | null,
      event_date: (r.event_date ?? null) as string | null,
    })),
  };
}

/** Heuristic: do we have enough data to bother generating a digest? */
export function hasEnoughForDigest(snapshot: WeeklyDigestSnapshot): boolean {
  return (
    snapshot.threads.length +
      snapshot.openTodos.length +
      snapshot.diaryEntries.length >=
    2
  );
}

/**
 * Ask Claude to write a warm, conversational ~120-word narration of
 * the family's week in BOTH languages. One model call returns both
 * versions, keyed by language, so the script tone stays consistent.
 *
 * The script is read aloud by ElevenLabs — keep punctuation natural,
 * avoid bracketed asides, use commas/periods for pacing.
 */
export async function generateDigestScripts(
  snapshot: WeeklyDigestSnapshot,
): Promise<DigestScripts | null> {
  if (!hasEnoughForDigest(snapshot)) return null;

  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      `You write short weekly family-life digests for a Vietnamese-` +
      `Australian family using a life-admin assistant. The digest will ` +
      `be read aloud by ElevenLabs to an elderly parent (Vietnamese) and ` +
      `an adult child (English).\n\n` +
      `Voice: warm, calm, present-tense, like a thoughtful family ` +
      `member catching everyone up over Sunday tea. Conversational, ` +
      `~110-130 words. Mention 3-5 concrete items by name from the ` +
      `data — don't list everything. Lead with what's coming up (events, ` +
      `due todos), then mention what happened (threads resolved, ` +
      `decisions logged). End with one warm closing line.\n\n` +
      `DO NOT include section headings, bullet points, or markdown — ` +
      `this is spoken word. Use natural prose with commas and periods.\n` +
      `DO NOT promise or fabricate items not in the data.\n` +
      `DO preserve Australian institution names (Medicare, Centrelink, ` +
      `ATO, myGov) in both language versions.\n\n` +
      `Return strict JSON only, no prose or fences:\n` +
      `{ "script_vi": string, "script_en": string }`,
    messages: [
      {
        role: "user",
        content:
          `Week starting: ${snapshot.weekStarting}\n\n` +
          `--- Recent threads (questions asked) ---\n` +
          (snapshot.threads.length === 0
            ? "(none)\n"
            : snapshot.threads
                .map(
                  (t) =>
                    `- "${t.title}" (${t.status}, started by ${t.initiated_by_role ?? "unknown"})`,
                )
                .join("\n") + "\n") +
          `\n--- Open todos ---\n` +
          (snapshot.openTodos.length === 0
            ? "(none)\n"
            : snapshot.openTodos
                .map(
                  (r) =>
                    `- ${r.text_en || r.text_vi}` +
                    (r.due_at ? ` (due ${r.due_at})` : ""),
                )
                .join("\n") + "\n") +
          `\n--- Diary entries this week ---\n` +
          (snapshot.diaryEntries.length === 0
            ? "(none)\n"
            : snapshot.diaryEntries
                .map(
                  (e) =>
                    `- [${e.kind}] ${e.title_en || e.title_vi || ""}` +
                    (e.event_date ? ` (date: ${e.event_date})` : ""),
                )
                .join("\n") + "\n"),
      },
    ],
  });

  const block = result.content[0];
  if (block?.type !== "text") return null;

  const raw = block.text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(raw) as Partial<DigestScripts>;
    if (
      typeof parsed.script_vi !== "string" ||
      typeof parsed.script_en !== "string" ||
      !parsed.script_vi.trim() ||
      !parsed.script_en.trim()
    ) {
      return null;
    }
    return {
      script_vi: parsed.script_vi.trim(),
      script_en: parsed.script_en.trim(),
    };
  } catch {
    return null;
  }
}
