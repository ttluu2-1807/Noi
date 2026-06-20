"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { extractTodos } from "@/lib/todo-extract";
import { detectLanguage } from "@/lib/language-detect";

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

  // Take just the first item — manual add is single-item by intent.
  const item = items[0];
  const { error } = await supabase.from("family_todos").insert({
    family_space_id: profile.family_space_id,
    created_by: user.id,
    text_vi: item.text_vi,
    text_en: item.text_en,
    due_at: item.due_at,
    assignee_role: item.assignee_role,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/todos");
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

  // Fetch current state to flip — avoids a separate "completed" param.
  const { data: row } = await supabase
    .from("family_todos")
    .select("is_completed")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  const next = !row.is_completed;
  await supabase
    .from("family_todos")
    .update({
      is_completed: next,
      completed_by: next ? user.id : null,
      completed_at: next ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath("/todos");
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
