import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { listFamilyTags } from "@/lib/tags";
import { DiaryComposer } from "../DiaryComposer";
import type { Language } from "@/lib/language-detect";

export const dynamic = "force-dynamic";

const T = {
  vi: {
    title: "Mục nhật ký mới",
    subtitle:
      "Ghi lại một sự kiện, quyết định gia đình, hoặc bất kỳ điều gì đáng nhớ.",
    back: "Nhật ký",
  },
  en: {
    title: "New diary entry",
    subtitle:
      "Capture an event, a family decision, or anything worth remembering.",
    back: "Diary",
  },
} as const;

export default async function NewDiaryEntryPage() {
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

  const familyTags = await listFamilyTags(supabase, profile.family_space_id);

  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-6">
      <header className="space-y-2">
        <Link
          href="/diary"
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
        <p className="text-sm text-muted">{t.subtitle}</p>
      </header>

      <DiaryComposer
        mode="new"
        familyTags={familyTags}
        familySpaceId={profile.family_space_id}
        language={language}
      />
    </main>
  );
}
