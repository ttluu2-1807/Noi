import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(app)/actions";
import { CopyableCode } from "./CopyableCode";
import { updateDisplayName, updateLanguagePreference } from "./actions";

export const dynamic = "force-dynamic";

const LABELS = {
  vi: {
    title: "Cài đặt",
    back: "Quay lại",
    name: "Tên hiển thị",
    save: "Lưu",
    language: "Ngôn ngữ",
    languageHelp: "Ngôn ngữ dùng để hiển thị trong ứng dụng.",
    vi: "Tiếng Việt",
    en: "English",
    code: "Mã gia đình",
    codeHelp: "Chia sẻ mã này để mời thành viên khác vào không gian gia đình.",
    signOut: "Đăng xuất",
  },
  en: {
    title: "Settings",
    back: "Back",
    name: "Display name",
    save: "Save",
    language: "Language",
    languageHelp: "Used to display content throughout the app.",
    vi: "Tiếng Việt",
    en: "English",
    code: "Family code",
    codeHelp: "Share this with a family member to invite them into your space.",
    signOut: "Sign out",
  },
} as const;

export default async function SettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, language_preference, family_space_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: family } = profile?.family_space_id
    ? await supabase
        .from("family_spaces")
        .select("invite_code")
        .eq("id", profile.family_space_id)
        .maybeSingle()
    : { data: null };

  const lang = (profile?.language_preference ?? "vi") as "vi" | "en";
  const t = LABELS[lang];
  const backHref = profile?.role === "parent" ? "/parent" : "/child";

  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-medium">{t.title}</h1>
        <Link href={backHref} className="text-sm text-muted hover:text-ink">
          ← {t.back}
        </Link>
      </header>

      <section className="rounded-card border border-line bg-white p-5 space-y-3">
        <form action={updateDisplayName} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted">{t.name}</span>
            <input
              type="text"
              name="name"
              defaultValue={profile?.display_name ?? ""}
              className="w-full rounded-card border border-line bg-white px-4 py-3 focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t.save}
          </button>
        </form>
      </section>

      <section className="rounded-card border border-line bg-white p-5 space-y-3">
        <div>
          <div className="text-sm text-muted">{t.language}</div>
          <p className="text-xs text-muted/80 mt-1">{t.languageHelp}</p>
        </div>
        <form action={updateLanguagePreference} className="grid grid-cols-2 gap-2">
          {(["vi", "en"] as const).map((code) => (
            <button
              key={code}
              name="language"
              value={code}
              type="submit"
              className={`rounded-card border px-4 py-3 text-sm transition-colors ${
                lang === code
                  ? "border-accent bg-accent/5 text-accent"
                  : "border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {code === "vi" ? t.vi : t.en}
            </button>
          ))}
        </form>
      </section>

      {family?.invite_code && (
        <section className="rounded-card border border-line bg-white p-5 space-y-3">
          <div>
            <div className="text-sm text-muted">{t.code}</div>
            <p className="text-xs text-muted/80 mt-1">{t.codeHelp}</p>
          </div>
          <CopyableCode code={family.invite_code} />
        </section>
      )}

      <form action={signOut} className="pt-2">
        <button
          type="submit"
          className="text-sm text-muted hover:text-ink underline underline-offset-4"
        >
          {t.signOut}
        </button>
      </form>
    </main>
  );
}
