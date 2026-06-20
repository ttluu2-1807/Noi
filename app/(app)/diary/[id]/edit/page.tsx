import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { listFamilyTags } from "@/lib/tags";
import { DiaryComposer } from "../../DiaryComposer";
import type { Language } from "@/lib/language-detect";
import type { Attachment } from "@/lib/storage";

export const dynamic = "force-dynamic";

const T = {
  vi: {
    title: "Sửa mục nhật ký",
    back: "Quay lại",
  },
  en: {
    title: "Edit entry",
    back: "Back",
  },
} as const;

export default async function EditDiaryEntryPage({
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

  const [{ data: entry }, familyTags] = await Promise.all([
    supabase
      .from("diary_entries")
      .select(
        "id, kind, title_vi, title_en, body_vi, body_en, context_vi, context_en, event_date, tags, attachments, deleted_at",
      )
      .eq("id", params.id)
      .maybeSingle(),
    listFamilyTags(supabase, profile.family_space_id),
  ]);
  if (!entry || entry.deleted_at) notFound();

  // Pre-fill the composer in the user's preferred language. They edit
  // in whichever language; on save we re-translate to the other.
  const initialTitle = (language === "vi" ? entry.title_vi : entry.title_en) ?? "";
  const initialBody = language === "vi" ? entry.body_vi : entry.body_en;
  const initialContext =
    language === "vi" ? entry.context_vi : entry.context_en;

  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-6">
      <header className="space-y-2">
        <Link
          href={`/diary/${entry.id}`}
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

      <DiaryComposer
        mode="edit"
        initialId={entry.id}
        initialKind={entry.kind as "event" | "decision" | "note"}
        initialTitle={initialTitle}
        initialBody={initialBody}
        initialContext={initialContext}
        initialEventDate={entry.event_date}
        initialTags={(entry.tags as string[]) ?? []}
        initialAttachments={(entry.attachments as Attachment[]) ?? []}
        familyTags={familyTags}
        familySpaceId={profile.family_space_id}
        language={language}
      />
    </main>
  );
}
