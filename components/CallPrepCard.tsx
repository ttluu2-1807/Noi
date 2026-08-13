"use client";

import { useState, useTransition } from "react";
import { generateCallPrepForThread } from "@/app/(app)/parent/thread/[id]/call-prep-actions";
import type { CallPrep } from "@/lib/call-prep";

interface CallPrepCardProps {
  threadId: string;
  /** Detected on the client from the answer text (see lib/call-prep). */
  service: string;
  phone: string;
  language: "vi" | "en";
}

const T = {
  vi: {
    prepButton: (svc: string) => `Chuẩn bị gọi ${svc}`,
    generating: "Đang chuẩn bị...",
    dialTitle: (svc: string, phone: string) => `Gọi ${svc} · ${phone}`,
    dial: "Bấm số",
    beforeHeading: "Chuẩn bị sẵn:",
    openingHeading: "Khi họ nghe máy, hãy nói:",
    questionsHeading: "Nếu họ hỏi:",
    escapeHeading: "Nếu quý vị bối rối:",
    leaveHeading: "Cần lấy được:",
    error: "Không tạo được kế hoạch. Vui lòng thử lại.",
    close: "Đóng",
  },
  en: {
    prepButton: (svc: string) => `Prepare to call ${svc}`,
    generating: "Preparing…",
    dialTitle: (svc: string, phone: string) => `Call ${svc} · ${phone}`,
    dial: "Dial now",
    beforeHeading: "Before you call, have:",
    openingHeading: "When they answer, say:",
    questionsHeading: "If they ask:",
    escapeHeading: "If you get stuck:",
    leaveHeading: "What to leave with:",
    error: "Couldn't build a plan. Please try again.",
    close: "Close",
  },
} as const;

/**
 * "Prepare to call" affordance for a parent thread. Renders as a small
 * pill button (matches the AskForHelp chip in visual weight). Tap →
 * generates a bilingual call plan on-demand and expands inline.
 *
 * The plan itself uses text-lead (17.5px) because it's read UNDER STRESS
 * while dialling — bigger than the surrounding body copy on purpose.
 * Every phrase pair renders side-by-side (VI on top so the parent
 * recognises the meaning, EN below so they know what to say). Never
 * translation-on-demand — visible together always.
 */
export function CallPrepCard({
  threadId,
  service,
  phone,
  language,
}: CallPrepCardProps) {
  const t = T[language];
  const [plan, setPlan] = useState<CallPrep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateCallPrepForThread({
        threadId,
        service,
        phone,
      });
      if (result.ok) {
        setPlan(result.plan);
      } else {
        setError(result.error || t.error);
      }
    });
  };

  if (!plan) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-green/40 bg-green-wash px-4 py-2 text-body-sm font-medium text-green-text hover:bg-green-wash/80 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <PhoneIcon />
          {pending ? t.generating : t.prepButton(service)}
        </button>
        {error && (
          <p className="text-body-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Rendered plan — everything sized for reading on a phone WHILE dialing.
  return (
    <section className="rounded-card border border-green/40 bg-surface p-5 space-y-5 animate-fade-rise">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title font-medium text-ink">
            {t.dialTitle(plan.service, plan.phone)}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`tel:${plan.phone.replace(/[^\d+]/g, "")}`}
            className="btn-primary rounded-card px-4 py-2 text-body-sm"
          >
            {t.dial}
          </a>
          <button
            type="button"
            onClick={() => setPlan(null)}
            aria-label={t.close}
            className="rounded-full p-1.5 text-ink-3 hover:bg-line/40"
          >
            <XIcon />
          </button>
        </div>
      </header>

      {plan.before_you_call.length > 0 && (
        <Section heading={t.beforeHeading}>
          <ul className="space-y-1.5">
            {plan.before_you_call.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <BulletDot />
                <div className="text-lead">
                  <div className="text-ink">{p.vi}</div>
                  <div className="text-ink-3 text-body">{p.en}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section heading={t.openingHeading}>
        <PhrasePair vi={plan.opening.vi} en={plan.opening.en} big />
      </Section>

      {plan.likely_questions.length > 0 && (
        <Section heading={t.questionsHeading}>
          <ul className="space-y-4">
            {plan.likely_questions.map((qa, i) => (
              <li key={i} className="rounded-control border border-line p-3 space-y-2">
                <div className="text-body-sm text-ink-3 italic">
                  <div>{qa.question_vi}</div>
                  <div>&ldquo;{qa.question_en}&rdquo;</div>
                </div>
                <div className="border-t border-line pt-2">
                  <PhrasePair vi={qa.answer.vi} en={qa.answer.en} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.escape_phrases.length > 0 && (
        <Section heading={t.escapeHeading}>
          <ul className="space-y-2">
            {plan.escape_phrases.map((p, i) => (
              <li key={i}>
                <PhrasePair vi={p.vi} en={p.en} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.what_to_leave_with.length > 0 && (
        <Section heading={t.leaveHeading}>
          <ul className="space-y-1.5">
            {plan.what_to_leave_with.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckBullet />
                <div className="text-lead">
                  <div className="text-ink">{p.vi}</div>
                  <div className="text-ink-3 text-body">{p.en}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </section>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-label uppercase tracking-wide text-green-text">
        {heading}
      </h4>
      {children}
    </div>
  );
}

function PhrasePair({ vi, en, big }: { vi: string; en: string; big?: boolean }) {
  return (
    <div className={big ? "text-title" : "text-lead"}>
      <div className="text-ink font-medium">{vi}</div>
      <div className="text-ink-3 text-body">{en}</div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function BulletDot() {
  return <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-ink-3 shrink-0" />;
}
function CheckBullet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 mt-1 shrink-0 text-green-text">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
