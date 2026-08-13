"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { switchFamily } from "./family-actions";
import type { Language } from "@/lib/language-detect";

interface Member {
  id: string;
  display_name: string;
  role: "parent" | "child";
  language_preference: "vi" | "en";
  joined_at: string;
  is_self: boolean;
}

interface FamilySectionProps {
  members: Member[];
  language: Language;
  errorFromQuery: string | null;
}

const T = {
  vi: {
    heading: "Gia đình",
    membersCount: (n: number) =>
      `${n} thành viên trong không gian gia đình.`,
    you: "Bạn",
    parent: "Ba/mẹ",
    child: "Người giúp",
    joinedRel: (iso: string) => `Tham gia ${relative(iso, "vi")}`,
    leaveHeading: "Rời khỏi gia đình này",
    leaveHint:
      "Nếu quý vị nhập nhầm mã, hoặc cần chuyển sang gia đình khác — nhập mã mới ở đây. Quý vị sẽ không thấy câu hỏi, việc cần làm, hay nhật ký của gia đình hiện tại nữa.",
    codeLabel: "Mã gia đình mới",
    switch: "Chuyển gia đình",
    warnHeading: "Quý vị có chắc chắn không?",
    warnBody:
      "Quý vị sẽ mất quyền xem dữ liệu của gia đình hiện tại. Các thành viên khác vẫn thấy được — chỉ quý vị không thấy nữa.",
    warnConfirm: "Đồng ý — Chuyển",
    warnCancel: "Huỷ",
  },
  en: {
    heading: "Family",
    membersCount: (n: number) =>
      `${n} ${n === 1 ? "member" : "members"} in this family space.`,
    you: "You",
    parent: "Parent",
    child: "Helper",
    joinedRel: (iso: string) => `Joined ${relative(iso, "en")}`,
    leaveHeading: "Leave this family",
    leaveHint:
      "If you entered the wrong code, or need to move to a different family — enter the new code here. You'll no longer see this family's threads, to-dos, or diary.",
    codeLabel: "New family code",
    switch: "Switch family",
    warnHeading: "Are you sure?",
    warnBody:
      "You'll lose your view of this family's data. Other members will still see everything — only you stop seeing it.",
    warnConfirm: "Yes — Switch",
    warnCancel: "Cancel",
  },
} as const;

/**
 * Family roster + "Switch family" surface on /settings.
 *
 * Roster is server-fetched (see /settings/page.tsx). This client
 * component handles the confirmation UX around switching families —
 * a destructive action for THIS user's view of their current family.
 * We double-tap to confirm (the switchFamily action itself is
 * irreversible except by knowing the old code again).
 */
export function FamilySection({
  members,
  language,
  errorFromQuery,
}: FamilySectionProps) {
  const t = T[language];
  const [switchOpen, setSwitchOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <section className="rounded-card border border-line bg-surface p-5 space-y-4">
        <div>
          <h2 className="text-body font-medium text-ink">{t.heading}</h2>
          <p className="text-body-sm text-ink-3 mt-0.5">
            {t.membersCount(members.length)}
          </p>
        </div>

        <ul className="space-y-2.5">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-control bg-paper px-3 py-2.5"
            >
              <span
                aria-hidden
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-body-sm font-medium ${
                  m.role === "parent"
                    ? "bg-clay-wash text-clay-deep"
                    : "bg-green-wash text-green-text"
                }`}
              >
                {initials(m.display_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body text-ink truncate">
                  {m.display_name}
                  {m.is_self && (
                    <span className="text-body-sm text-ink-3 font-normal ml-1.5">
                      · {t.you}
                    </span>
                  )}
                </p>
                <p className="text-body-sm text-ink-3">
                  {m.role === "parent" ? t.parent : t.child}
                  {" · "}
                  {m.language_preference === "vi" ? "Tiếng Việt" : "English"}
                  {" · "}
                  {t.joinedRel(m.joined_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setSwitchOpen((v) => !v)}
            className="text-body-sm text-ink-3 hover:text-ink underline underline-offset-4"
          >
            {t.leaveHeading}
          </button>
        </div>

        {switchOpen && (
          <div className="rounded-control border border-line bg-paper p-4 space-y-3">
            <p className="text-body-sm text-ink-2">{t.leaveHint}</p>
            <label className="block space-y-1">
              <span className="text-body-sm text-ink-3">
                {t.codeLabel}
              </span>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  )
                }
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ABC123"
                disabled={pending}
                className="w-full rounded-control border border-line bg-surface px-3 py-2 text-body tracking-widest uppercase focus:border-green focus:outline-none"
              />
            </label>
            {errorFromQuery && (
              <p className="text-body-sm text-danger" role="alert">
                {errorFromQuery}
              </p>
            )}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending || code.length !== 6}
              className="btn-primary rounded-card px-4 py-2 text-body-sm"
            >
              {t.switch}
            </button>
          </div>
        )}
      </section>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-card bg-surface p-6 space-y-4 shadow-2xl animate-fade-rise">
            <h3 className="text-title font-medium text-ink">
              {t.warnHeading}
            </h3>
            <p className="text-body text-ink-2">{t.warnBody}</p>
            {/* Actual submit — the server action handles redirect. */}
            <form
              action={switchFamily}
              onSubmit={() => startTransition(() => {})}
              className="flex items-center justify-end gap-2 pt-1"
            >
              <input type="hidden" name="code" value={code} />
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="rounded-card border border-line bg-surface px-4 py-2 text-body-sm text-ink-3 hover:text-ink"
              >
                {t.warnCancel}
              </button>
              <SubmitButton
                pendingLabel={t.switch + "…"}
                className="btn-primary rounded-card px-4 py-2 text-body-sm"
              >
                {t.warnConfirm}
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// Very cheap relative-time — good enough for a settings roster.
function relative(iso: string, lang: "vi" | "en"): string {
  const now = new Date();
  const then = new Date(iso);
  const days = Math.max(
    0,
    Math.round((now.getTime() - then.getTime()) / (24 * 60 * 60 * 1000)),
  );
  if (lang === "vi") {
    if (days === 0) return "hôm nay";
    if (days === 1) return "hôm qua";
    if (days < 7) return `${days} ngày trước`;
    if (days < 30) return `${Math.round(days / 7)} tuần trước`;
    return then.toLocaleDateString("vi-VN", { day: "numeric", month: "long" });
  }
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return then.toLocaleDateString("en-AU", { day: "numeric", month: "long" });
}
