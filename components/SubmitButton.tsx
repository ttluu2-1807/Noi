"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  /** Idle label. */
  children: React.ReactNode;
  /** Pending label. Falls back to a spinner + idle label. */
  pendingLabel?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Set on the underlying <button>, e.g. for accessibility hooks. */
  ariaLabel?: string;
}

/**
 * Drop-in replacement for `<button type="submit">` inside any form bound
 * to a Server Action. Reads pending state via `useFormStatus()` and shows
 * a spinner + alternate label automatically.
 *
 * Why we need this: Server Actions are POST requests that round-trip to
 * the server. Between tap and re-render there's often 200ms–2s of dead
 * air. With no pending feedback, elderly users assume the tap didn't
 * register and re-tap, causing double-submits. This solves both issues:
 * the button visibly enters a busy state on the first tap, and becomes
 * non-interactive until the action completes.
 *
 * Place this inside the form, not outside — `useFormStatus` only reads
 * the status of its closest ancestor form.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
  disabled,
  ariaLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {pending && <Spinner />}
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 animate-spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
