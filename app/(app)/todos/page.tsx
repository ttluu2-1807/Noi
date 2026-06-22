import { Suspense } from "react";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { HeaderMenu } from "@/components/HeaderMenu";
import { TodoComposer } from "./TodoComposer";
import { TodoList, type TodoRow } from "./TodoList";
import { fetchFamilyMembers, membersById } from "@/lib/family-members";
import type { Language } from "@/lib/language-detect";


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
 * FAM-2 — family-shared to-do list.
 *
 * Restructured with Suspense streaming (mirrors the thread-page pattern
 * from PERF-1):
 *
 *   Critical path  → auth + profile + family record. Fast, gates rendering.
 *   Header + composer render the moment that resolves (~150-250ms).
 *
 *   Suspense block → the todos list itself, which is the heaviest query.
 *   Streams in below the composer when ready (~50-150ms after the header).
 *
 * Net effect: tap "To-do list" in the menu → loading.tsx skeleton flashes
 * → header + composer render → todos pop in. Composer is interactive
 * before the list arrives.
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

  // Family invite code is tiny and shown in HeaderMenu — keep in critical
  // path so the menu has it without a second flash. Cheap query.
  const { data: family } = await supabase
    .from("family_spaces")
    .select("invite_code")
    .eq("id", profile.family_space_id)
    .maybeSingle();

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

        <Suspense fallback={<TodoListSkeleton />}>
          <TodoListSection
            familySpaceId={profile.family_space_id}
            language={language}
          />
        </Suspense>
      </main>
    </RealtimeBoundary>
  );
}

/**
 * Async sub-component streamed via the page's <Suspense>. Holds the
 * actual family_todos query so it doesn't block the header + composer.
 */
async function TodoListSection({
  familySpaceId,
  language,
}: {
  familySpaceId: string;
  language: Language;
}) {
  const supabase = createServerClient();
  const [todosResult, members] = await Promise.all([
    supabase
      .from("family_todos")
      .select(
        "id, text_vi, text_en, due_at, assignee_role, is_completed, completed_at, created_at, created_by",
      )
      .eq("family_space_id", familySpaceId)
      .is("deleted_at", null)
      .order("is_completed", { ascending: true })
      .order("created_at", { ascending: false }),
    fetchFamilyMembers(supabase, familySpaceId),
  ]);
  const memberNames: Record<string, string> = Object.fromEntries(
    Object.entries(membersById(members)).map(([id, m]) => [id, m.display_name]),
  );
  return (
    <TodoList
      items={(todosResult.data ?? []) as TodoRow[]}
      language={language}
      memberNames={memberNames}
    />
  );
}

function TodoListSkeleton() {
  return (
    <section className="space-y-2 animate-pulse">
      <div className="h-3 w-20 rounded bg-line/40" />
      <div className="h-14 rounded-card border border-line bg-white" />
      <div className="h-14 rounded-card border border-line bg-white" />
      <div className="h-14 rounded-card border border-line bg-white" />
    </section>
  );
}
