import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { TrashList, type DeletedThread, type DeletedTodo, type DeletedDiaryEntry } from "./TrashList";
import type { Language } from "@/lib/language-detect";


const T = {
  vi: {
    title: "Thùng rác",
    subtitle:
      "Các mục đã xoá sẽ ở đây trong 30 ngày — quý vị có thể khôi phục bất cứ lúc nào.",
    back: "Quay lại",
    threads: "Câu hỏi đã xoá",
    todos: "Việc đã xoá",
    empty: "Thùng rác trống.",
  },
  en: {
    title: "Trash",
    subtitle:
      "Deleted items live here for 30 days — you can restore anything from this list.",
    back: "Back",
    threads: "Deleted threads",
    todos: "Deleted to-dos",
    empty: "Nothing in the trash.",
  },
} as const;

/**
 * /trash — view soft-deleted threads + to-dos for the family, with
 * one-tap restore. Items in the trash are NOT shown anywhere else in
 * the app. The 30-day auto-purge is not implemented yet — items stay
 * here indefinitely until explicitly restored or cleared.
 */
export default async function TrashPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, language_preference, family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;

  const language = (profile.language_preference ?? "vi") as Language;
  const t = T[language];
  const backHref = profile.role === "parent" ? "/parent" : "/child";

  const [threadsResult, todosResult, diaryResult] = await Promise.all([
    supabase
      .from("threads")
      .select("id, title_vi, title_en, deleted_at")
      .eq("family_space_id", profile.family_space_id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("family_todos")
      .select("id, text_vi, text_en, deleted_at")
      .eq("family_space_id", profile.family_space_id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("diary_entries")
      .select("id, kind, title_vi, title_en, deleted_at")
      .eq("family_space_id", profile.family_space_id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  const deletedThreads = (threadsResult.data ?? []) as DeletedThread[];
  const deletedTodos = (todosResult.data ?? []) as DeletedTodo[];
  const deletedDiary = (diaryResult.data ?? []) as DeletedDiaryEntry[];

  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-8">
      <header className="space-y-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t.back}
        </Link>
        <h1 className="text-2xl font-medium">{t.title}</h1>
        <p className="text-sm text-muted">{t.subtitle}</p>
      </header>

      <TrashList
        threads={deletedThreads}
        todos={deletedTodos}
        diary={deletedDiary}
        language={language}
      />
    </main>
  );
}
