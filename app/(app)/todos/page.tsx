import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { HeaderMenu } from "@/components/HeaderMenu";
import { TodoComposer } from "./TodoComposer";
import { TodoList, type TodoRow } from "./TodoList";
import type { Language } from "@/lib/language-detect";

export const dynamic = "force-dynamic";

const T = {
  vi: {
    title: "Việc cần làm",
    subtitle: "Danh sách dùng chung của cả gia đình.",
    back: "Trang chủ",
  },
  en: {
    title: "To-do list",
    subtitle: "Shared list for the whole family.",
    back: "Home",
  },
} as const;

/**
 * FAM-2 — the family-shared to-do list. Both roles see the same list.
 * Voice dictation at the top splits into discrete items via Claude;
 * tick-off / delete persist via Server Actions. Realtime keeps both
 * users in sync.
 */
export default async function TodosPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, family_space_id, language_preference")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;
  const language = (profile.language_preference ?? "vi") as Language;
  const t = T[language];

  const { data: family } = await supabase
    .from("family_spaces")
    .select("invite_code")
    .eq("id", profile.family_space_id)
    .maybeSingle();

  const { data: todos } = await supabase
    .from("family_todos")
    .select(
      "id, text_vi, text_en, due_at, assignee_role, is_completed, completed_at, created_at",
    )
    .eq("family_space_id", profile.family_space_id)
    .order("is_completed", { ascending: true })
    .order("created_at", { ascending: false });

  // Send the parent to the parent root, the child to the child root.
  const homeHref = profile.role === "parent" ? "/parent" : "/child";

  return (
    <RealtimeBoundary
      tables={["family_todos"]}
      channelName={`family-todos-${profile.family_space_id}`}
    >
      <main className="mx-auto max-w-md px-6 py-10 space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={homeHref}
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
          </div>
          <HeaderMenu
            role={profile.role as "parent" | "child"}
            language={language}
            displayName={profile.display_name ?? ""}
            inviteCode={family?.invite_code ?? null}
          />
        </header>

        <TodoComposer language={language} />

        <TodoList items={(todos ?? []) as TodoRow[]} language={language} />
      </main>
    </RealtimeBoundary>
  );
}
