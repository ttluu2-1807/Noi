import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { stripMarkdown, truncateOnWord } from "@/lib/markdown";

/**
 * High-level notification helpers built on top of lib/push.
 *
 * These wrap the "fan out to other family members" pattern so caller
 * sites don't have to know about profiles/subscriptions. Fire-and-forget
 * — errors are logged but don't propagate (a bad push shouldn't fail
 * a message insert).
 *
 * Rules:
 *   · Never push the actor back to themselves
 *   · Skip if the message text is empty (e.g. attachment-only bubble)
 *   · Every push carries a URL that deep-links to the thread
 *   · Titles are name-based ("Mai asked", "Dad replied") when we know
 *     the display_name — falls back to a generic role label otherwise
 */

interface NotifyThreadInput {
  familySpaceId: string;
  threadId: string;
  actorUserId: string;
  /** Bilingual thread title + snippet — used to build the push body. */
  titleVi: string | null;
  titleEn: string | null;
  bodyVi: string | null;
  bodyEn: string | null;
  /** 'new-thread' | 'new-reply' — affects the title copy. */
  kind: "new-thread" | "new-reply";
}

const PREVIEW_MAX = 90;

export async function notifyFamilyOfThreadActivity(
  input: NotifyThreadInput,
): Promise<void> {
  try {
    const admin = createServiceRoleClient();

    // Actor's display name for the push title.
    const [actorRes, membersRes] = await Promise.all([
      admin
        .from("profiles")
        .select("display_name, role")
        .eq("id", input.actorUserId)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id, language_preference, role")
        .eq("family_space_id", input.familySpaceId)
        .neq("id", input.actorUserId),
    ]);

    const actorName =
      (actorRes.data?.display_name as string | null) ??
      (actorRes.data?.role === "parent" ? "Parent" : "Family");
    const members = membersRes.data ?? [];

    await Promise.all(
      members.map(async (m) => {
        const language = (m.language_preference ?? "vi") as "vi" | "en";
        // Determine the recipient-role thread base for the deep link
        // so a parent lands on /parent/thread and a child on /child/thread.
        const base = m.role === "parent" ? "/parent/thread" : "/child/thread";

        const title = buildTitle(input.kind, actorName, language);
        const body = buildBody(input, language);

        await sendPushToUser(m.id as string, {
          title,
          body,
          url: `${base}/${input.threadId}`,
          // Tag by thread so multiple replies on the same thread coalesce
          // into a single stack in the OS shade.
          tag: `noi-thread-${input.threadId}`,
        });
      }),
    );
  } catch (err) {
    console.error("[notify] thread activity fan-out failed:", err);
    // Swallow — never fail the caller's insert because of a push miss.
  }
}

function buildTitle(
  kind: NotifyThreadInput["kind"],
  actorName: string,
  language: "vi" | "en",
): string {
  if (language === "vi") {
    return kind === "new-thread"
      ? `${actorName} vừa hỏi Noi`
      : `${actorName} đã trả lời`;
  }
  return kind === "new-thread"
    ? `${actorName} asked Noi something`
    : `${actorName} replied`;
}

function buildBody(input: NotifyThreadInput, language: "vi" | "en"): string {
  const primary = language === "vi" ? input.titleVi : input.titleEn;
  const secondary = language === "vi" ? input.bodyVi : input.bodyEn;
  const source =
    (primary && primary.trim()) ||
    (secondary && secondary.trim()) ||
    "";
  if (!source) {
    return language === "vi" ? "Xem trong Noi." : "Open Noi to read.";
  }
  return truncateOnWord(stripMarkdown(source), PREVIEW_MAX);
}
