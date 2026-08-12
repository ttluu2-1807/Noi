"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Language } from "@/lib/language-detect";

interface TabBarProps {
  role: "parent" | "child";
  language: Language;
}

const T = {
  vi: {
    home: "Trang chủ",
    threads: "Câu hỏi",
    list: "Việc cần làm",
    diary: "Nhật ký",
  },
  en: {
    home: "Home",
    threads: "Threads",
    list: "To-dos",
    diary: "Diary",
  },
} as const;

/**
 * Persistent four-tab bar shown on every app surface, per audit T3.
 *
 * Tabs: Home, Threads, List, Diary. Home routes to /parent or /child
 * depending on role; the other three are role-agnostic list pages.
 *
 * Active-tab detection is pathname-prefix based. `/parent` and
 * `/child` both count as Home. Anything under `/threads` or
 * `/{parent,child}/thread` is Threads. Everything else is prefix-
 * matched directly.
 *
 * Sits fixed at the bottom with safe-area padding so the home
 * indicator doesn't overlap. Content pages should reserve pb-24 or
 * similar to avoid hiding tail content behind the bar.
 */
export function TabBar({ role, language }: TabBarProps) {
  const t = T[language];
  const pathname = usePathname();
  const homeHref = role === "parent" ? "/parent" : "/child";

  const isHome =
    pathname === "/parent" || pathname === "/child";
  const isThreads =
    pathname.startsWith("/threads") ||
    pathname.startsWith("/parent/thread") ||
    pathname.startsWith("/child/thread") ||
    pathname.startsWith("/child/new-task");
  const isList = pathname.startsWith("/todos");
  const isDiary = pathname.startsWith("/diary");

  return (
    <nav
      aria-label="Primary"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line"
    >
      <ul className="mx-auto max-w-md flex items-stretch justify-around">
        <Tab
          href={homeHref}
          active={isHome}
          label={t.home}
          icon={<HomeIcon />}
        />
        <Tab
          href="/threads"
          active={isThreads}
          label={t.threads}
          icon={<ChatIcon />}
        />
        <Tab
          href="/todos"
          active={isList}
          label={t.list}
          icon={<ListIcon />}
        />
        <Tab
          href="/diary"
          active={isDiary}
          label={t.diary}
          icon={<DiaryIcon />}
        />
      </ul>
    </nav>
  );
}

function Tab({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-0.5 py-2.5 text-nav transition-colors ${
          active ? "text-green" : "text-ink-3 hover:text-ink"
        }`}
      >
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.4-4 8-9 8a9.9 9.9 0 0 1-4-.8L3 20l1.3-3.4A7.9 7.9 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8z" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
function DiaryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h11a1 1 0 011 1v16a1 1 0 01-1 1H6a2 2 0 01-2-2V5zm0 0v14a2 2 0 002 2M8 7h6M8 11h6" />
    </svg>
  );
}
