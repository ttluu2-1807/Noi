"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(app)/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { Language } from "@/lib/language-detect";

interface HeaderMenuProps {
  role: "parent" | "child";
  language: Language;
  displayName: string;
  /** The family's 6-character invite code, for sharing. */
  inviteCode: string | null;
}

const T = {
  vi: {
    settings: "Cài đặt",
    signOut: "Đăng xuất",
    familyCode: "Mã gia đình",
    copy: "Sao chép",
    copied: "Đã sao chép",
  },
  en: {
    settings: "Settings",
    signOut: "Sign out",
    familyCode: "Family code",
    copy: "Copy",
    copied: "Copied",
  },
} as const;

/**
 * Single hamburger-style avatar button + dropdown that replaces the old
 * row of header pills (New task / Settings / Sign out). The avatar is
 * a teal circle with the user's first initial — recognisable, single
 * tap target, and works on any screen size without wrapping.
 *
 * Dropdown contents:
 *   - Family code (with copy-to-clipboard button)
 *   - Settings link
 *   - Sign out (Server Action with pending state)
 *
 * Closes on outside click or Escape. Anchored right-aligned so it
 * doesn't overflow the viewport on small phones.
 */
export function HeaderMenu({ role, language, displayName, inviteCode }: HeaderMenuProps) {
  const t = T[language];
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        menuRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (displayName || (role === "parent" ? "P" : "C")).trim().charAt(0).toUpperCase();

  const copyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers won't get feedback — code is still visible.
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.settings}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white font-medium transition-transform active:scale-95 hover:opacity-90"
      >
        {initial}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-12 z-30 w-64 rounded-card border border-line bg-white shadow-lg overflow-hidden"
        >
          {inviteCode && (
            <div className="px-4 py-3 border-b border-line">
              <div className="text-xs text-muted">{t.familyCode}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-lg font-medium tracking-widest text-accent">
                  {inviteCode}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="text-xs text-muted hover:text-ink transition-colors active:scale-95"
                >
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            </div>
          )}

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm hover:bg-bg active:bg-line transition-colors"
          >
            {t.settings}
          </Link>

          <form action={signOut} className="border-t border-line">
            <SubmitButton
              pendingLabel={language === "vi" ? "Đang đăng xuất…" : "Signing out…"}
              className="w-full px-4 py-3 text-sm text-left text-muted hover:bg-bg active:bg-line transition-colors !justify-start"
            >
              {t.signOut}
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
