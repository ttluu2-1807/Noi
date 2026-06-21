import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TodoEditForm } from "./TodoEditForm";
import type { Language } from "@/lib/language-detect";

export const dynamic = "force-dynamic";

const T = {
  vi: { title: "Sửa việc cần làm", back: "Quay lại" },
  en: { title: "Edit to-do", back: "Back" },
} as const;

export default async function EditTodoPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("language_preference, family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;
  const language = (profile.language_preference ?? "vi") as Language;
  const t = T[language];

  const { data: todo } = await supabase
    .from("family_todos")
    .select("id, text_vi, text_en, due_at, deleted_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!todo || todo.deleted_at) notFound();

  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-6">
      <header className="space-y-2">
        <Link
          href="/todos"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t.back}
        </Link>
        <h1 className="text-2xl font-medium">{t.title}</h1>
      </header>

      <TodoEditForm
        id={todo.id}
        initialText={
          language === "vi" ? todo.text_vi : todo.text_en
        }
        initialDueAt={todo.due_at}
        language={language}
      />
    </main>
  );
}
