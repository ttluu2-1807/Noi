"use client";

import { useTransition } from "react";
import { resolveEscalation } from "@/app/(app)/parent/thread/[id]/escalate-actions";

interface EscalationBannerProps {
  threadId: string;
  escalatedByName: string | null;
  escalationNote: string | null;
}

/**
 * Child-side banner shown on a thread that a parent has flagged with
 * "I need help with this". Two things it does:
 *   · Signals urgency at a glance (clay tint, bell icon, name in the line)
 *   · One-tap "Mark as helped" that clears the escalation and pushes
 *     the parent back that someone's on it
 */
export function EscalationBanner({
  threadId,
  escalatedByName,
  escalationNote,
}: EscalationBannerProps) {
  const [pending, startTransition] = useTransition();

  const resolve = () => {
    startTransition(async () => {
      await resolveEscalation({ threadId });
    });
  };

  const who = escalatedByName ?? "Family";

  return (
    <section className="rounded-card border border-clay/40 bg-clay-wash p-4 space-y-3 animate-fade-rise">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="shrink-0 mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-clay text-white"
        >
          <BellIcon />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-label uppercase tracking-wide text-clay-deep">
            {who} needs your help
          </p>
          {escalationNote && (
            <p className="text-body text-ink italic">&ldquo;{escalationNote}&rdquo;</p>
          )}
          <p className="text-body-sm text-ink-2">
            Read what Noi has said so far, then reply below or take over
            in person.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={resolve}
          disabled={pending}
          className="rounded-full border border-clay-deep/30 bg-surface px-4 py-1.5 text-body-sm font-medium text-clay-deep hover:bg-clay-wash active:scale-[0.98] transition-transform"
        >
          {pending ? "Marking…" : "I've got this"}
        </button>
      </div>
    </section>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14V11a6 6 0 1 0-12 0v3a2 2 0 0 1-.6 1.6L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  );
}
