"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateCallPrep, type CallPrep } from "@/lib/call-prep";

/**
 * Generate a bilingual call-prep card from the thread the parent is
 * looking at. We concat the last few messages in that thread as
 * "context" and hand it to Claude with the phone + service already
 * detected on the client. Returns the structured plan (or an error
 * string on failure).
 *
 * Not persisted — regenerate on tap. If real usage shows parents
 * want to pull up an old plan later without connectivity, we can add
 * a call_plans table + save on generate.
 */
export async function generateCallPrepForThread(input: {
  threadId: string;
  service: string;
  phone: string;
}): Promise<{ ok: true; plan: CallPrep } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: messages } = await supabase
    .from("messages")
    .select("sender_role, content_en, content_vi, created_at")
    .eq("thread_id", input.threadId)
    .order("created_at", { ascending: false })
    .limit(6);
  if (!messages || messages.length === 0) {
    return { ok: false, error: "No thread context available." };
  }

  // Compose the context prose in EN (Claude works well from EN + we
  // just ask for the output in both languages).
  const context = messages
    .reverse()
    .map((m) => {
      const who =
        m.sender_role === "assistant"
          ? "Noi"
          : m.sender_role === "parent"
            ? "Parent"
            : "Family";
      return `${who}: ${m.content_en ?? m.content_vi ?? ""}`;
    })
    .join("\n\n");

  try {
    const plan = await generateCallPrep({
      service: input.service,
      phone: input.phone,
      threadContext: context,
    });
    if (!plan) {
      return { ok: false, error: "Could not generate a call plan." };
    }
    return { ok: true, plan };
  } catch (err) {
    console.error("[call-prep] generate failed:", err);
    return {
      ok: false,
      error: "Could not generate a call plan. Please try again.",
    };
  }
}
