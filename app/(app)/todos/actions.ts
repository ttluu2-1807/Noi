"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { extractTodos } from "@/lib/todo-extract";
import { detectLanguage } from "@/lib/language-detect";
import { nextDueAt, type Recurrence, type Rollover } from "@/lib/recurrence";

/**
 * Server actions for the family-shared to-do list (FAM-2).
 *
 * - dictateTodos: take a free-form transcript, split into items via
 *   Claude, insert each into family_todos. Returns count of items
 *   created so the client can show feedback.
 * - addTodo: manual single-item add from text input.
 * - toggleTodo: mark complete / un-complete.
 * - deleteTodo: hard delete (no undo for now).
 *
 * Realtime in the page picks up the inserts/updates and refreshes the
 * server component, so we don't need optimistic client state in the
 * dictate path.
 */

export async function dictateTodos(
  formData: FormData,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) return { ok: false, error: "Transcript is empty" };

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
  if (!profile?.family_space_id) return { ok: false, error: "Profile not ready" };

  const inputLanguage = detectLanguage(transcript);

  let items;
  try {
    items = await extractTodos(transcript, inputLanguage, new Date().toISOString());
  } catch (err) {
    console.error("[todos.dictate]", err);
    return { ok: false, error: "Could not parse the dictation" };
  }
  if (items.length === 0) {
    return { ok: false, error: "No tasks detected. Please try again." };
  }

  const { error } = await supabase.from("family_todos").insert(
    items.map((item, idx) => ({
      family_space_id: profile.family_space_id,
      created_by: user.id,
      text_vi: item.text_vi,
      text_en: item.text_en,
      due_at: item.due_at,
      assignee_role: item.assignee_role,
      sort_order: idx,
    })),
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/todos");
  return { ok: true, count: items.length };
}

export async function addTodo(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { ok: false, error: "Text is empty" };

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
  if (!profile?.family_space_id) return { ok: false, error: "Profile not ready" };

  // For a manual add, treat the input language as the source of truth
  // and translate the other way. extractTodos handles both, but for a
  // single one-liner we can keep it lighter by going straight to insert
  // with the input as one side and Claude only on translation. To keep
  // a single code path, reuse extractTodos with one-item expectation.
  const inputLang = detectLanguage(text);

  let items;
  try {
    items = await extractTodos(text, inputLang, new Date().toISOString());
  } catch {
    return { ok: false, error: "Could not save that task" };
  }
  if (items.length === 0) return { ok: false, error: "Couldn't read that task" };

  // Merged-list linkage: chips inside a thread pass sourceThreadId so
  // the item on /todos groups under a header linking back to the thread
  // that produced it. Owner can be pre-set from the composer/picker.
  const sourceThreadId = String(formData.get("sourceThreadId") ?? "").trim() || null;
  const ownerId = String(formData.get("ownerId") ?? "").trim() || null;
  const recurrenceRaw = String(formData.get("recurrence") ?? "").trim();
  const rolloverRaw = String(formData.get("rollover") ?? "").trim();
  const recurrence: Recurrence | null =
    recurrenceRaw === "fortnightly" ||
    recurrenceRaw === "monthly" ||
    recurrenceRaw === "quarterly" ||
    recurrenceRaw === "annually"
      ? recurrenceRaw
      : null;
  const rollover: Rollover = rolloverRaw === "spawn" ? "spawn" : "reset";

  // Take just the first item — manual add is single-item by intent.
  const item = items[0];
  const { error } = await supabase.from("family_todos").insert({
    family_space_id: profile.family_space_id,
    created_by: user.id,
    text_vi: item.text_vi,
    text_en: item.text_en,
    due_at: item.due_at,
    assignee_role: item.assignee_role,
    source_thread_id: sourceThreadId,
    owner_id: ownerId,
    recurrence,
    rollover: recurrence ? rollover : null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/todos");
  revalidatePath("/parent");
  revalidatePath("/child");
  return { ok: true };
}

/**
 * Edit an existing todo. Re-translates the text to the other language
 * via Claude (same path as initial create — the existing extractTodos
 * helper handles dual-language synthesis from a single-language input).
 * Date is replaced wholesale; pass null to clear.
 */
export async function updateTodo(input: {
  id: string;
  text: string;
  due_at: string | null;
  /** null = one-off (default). Set to change recurrence cadence. */
  recurrence?: Recurrence | null;
  /** Only meaningful when recurrence is set. Defaults to "reset". */
  rollover?: Rollover;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id" };
  const text = input.text.trim();
  if (!text) return { ok: false, error: "Text is empty" };

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
  if (!profile?.family_space_id) return { ok: false, error: "Profile not ready" };

  // Reuse extractTodos for the dual-language synthesis. It splits a
  // free-form transcript into items — we pass a single-item input and
  // take the first result.
  const inputLang = detectLanguage(text);
  let items;
  try {
    items = await extractTodos(text, inputLang, new Date().toISOString());
  } catch {
    return { ok: false, error: "Could not save that task" };
  }
  if (items.length === 0) return { ok: false, error: "Couldn't read that task" };
  const item = items[0];

  const patch: Record<string, unknown> = {
    text_vi: item.text_vi,
    text_en: item.text_en,
    // Prefer the explicit caller-provided due_at if set, else use what
    // Claude extracted (which may be null if no date was mentioned).
    due_at: input.due_at ?? item.due_at,
  };
  if (input.recurrence !== undefined) patch.recurrence = input.recurrence;
  if (input.rollover !== undefined) patch.rollover = input.rollover;

  const { error } = await supabase
    .from("family_todos")
    .update(patch)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/todos");
  revalidatePath(`/todos/${input.id}/edit`);
  return { ok: true };
}

export async function toggleTodo(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Pull enough state to decide whether this is a recurring toggle and,
  // if so, which rollover policy to apply.
  const { data: row } = await supabase
    .from("family_todos")
    .select(
      "family_space_id, is_completed, recurrence, rollover, due_at, text_vi, text_en, assignee_role, owner_id, source_thread_id, sort_order",
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  const next = !row.is_completed;
  const nowIso = new Date().toISOString();
  const recurrence = (row.recurrence ?? null) as Recurrence | null;
  const rollover = (row.rollover ?? "reset") as Rollover;

  // Non-recurring OR un-completing: plain toggle.
  if (!recurrence || !next) {
    await supabase
      .from("family_todos")
      .update({
        is_completed: next,
        completed_by: next ? user.id : null,
        completed_at: next ? nowIso : null,
      })
      .eq("id", id);
    revalidatePath("/todos");
    revalidatePath("/parent");
    revalidatePath("/child");
    return;
  }

  // Recurring + toggling to complete. Two policies:
  //   reset — same row, bump due_at, stay uncompleted (history compact)
  //   spawn — mark this instance done AND insert a fresh row for next
  const nextDue = nextDueAt(row.due_at as string | null, recurrence);

  if (rollover === "reset") {
    await supabase
      .from("family_todos")
      .update({
        // Note: row stays is_completed=false so it lives in the open
        // bucket — the whole point of a recurring task is you're never
        // "done" with it forever, just done for this cycle.
        is_completed: false,
        completed_by: null,
        completed_at: null,
        due_at: nextDue,
      })
      .eq("id", id);
  } else {
    // spawn: mark this instance completed, insert a new row for next.
    await Promise.all([
      supabase
        .from("family_todos")
        .update({
          is_completed: true,
          completed_by: user.id,
          completed_at: nowIso,
        })
        .eq("id", id),
      supabase.from("family_todos").insert({
        family_space_id: row.family_space_id,
        created_by: user.id,
        text_vi: row.text_vi,
        text_en: row.text_en,
        due_at: nextDue,
        assignee_role: row.assignee_role,
        owner_id: row.owner_id ?? null,
        source_thread_id: row.source_thread_id ?? null,
        recurrence,
        rollover,
        sort_order: row.sort_order ?? 0,
      }),
    ]);
  }

  revalidatePath("/todos");
  revalidatePath("/parent");
  revalidatePath("/child");
}

/**
 * Soft-delete a todo. Sets `deleted_at = now()`. The todos list query
 * filters on `deleted_at is null` so it vanishes immediately; restorable
 * within the 30-day window via the undo toast or /trash.
 */
export async function deleteTodo(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing id" };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("family_todos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/todos");
  revalidatePath("/trash");
  return { ok: true };
}

/**
 * Restore a soft-deleted todo. Called by the undo toast and by /trash.
 */
export async function restoreTodo(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id" };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("family_todos")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/todos");
  revalidatePath("/trash");
  return { ok: true };
}
