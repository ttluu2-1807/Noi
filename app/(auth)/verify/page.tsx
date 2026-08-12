import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { CodeInput } from "./CodeInput";
import { resendMagicLink, verifyOtpCode } from "./actions";

/**
 * "Check your email" page — but with the OTP code entry as the primary
 * path (per audit screen 17: "Six boxes, paste fills all"), because
 * cross-context magic-link URL taps fail on iOS Mail → Safari with the
 * PKCE code_verifier missing. The link still works when it works; the
 * code always works.
 */
export default function VerifyPage({
  searchParams,
}: {
  searchParams: { email?: string; resent?: string; error?: string };
}) {
  const email = searchParams.email ?? "";

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <div
          aria-hidden
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-wash"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-8 w-8 text-green-text"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-display font-medium">Check your email</h1>
        <p className="text-ink-3">
          We sent a code to{" "}
          <span className="text-ink font-medium">{email || "your email"}</span>.
        </p>
      </div>

      <form action={verifyOtpCode} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <div className="space-y-2">
          <label className="block text-label uppercase tracking-wide text-ink-3 text-center">
            Enter the code
          </label>
          {/* OTP length matches the Supabase project setting (Auth →
              Providers → Email → OTP Length). This project is 8. */}
          <CodeInput name="code" length={8} />
        </div>

        {searchParams.error && (
          <p className="text-body-sm text-danger text-center" role="alert">
            {searchParams.error}
          </p>
        )}

        <SubmitButton
          pendingLabel="Signing in…"
          className="btn-primary w-full rounded-card px-4 py-3"
        >
          Continue
        </SubmitButton>
      </form>

      <div className="text-center space-y-3 text-body-sm">
        <p className="text-ink-3">
          Or tap the link in the email — either works.
        </p>

        {searchParams.resent && (
          <p className="text-green-text">A fresh code is on the way.</p>
        )}

        <form action={resendMagicLink}>
          <input type="hidden" name="email" value={email} />
          <SubmitButton
            pendingLabel="Sending…"
            className="text-ink-3 hover:text-ink underline underline-offset-4"
          >
            Send a new code
          </SubmitButton>
        </form>

        <Link
          href="/login"
          className="block text-ink-3 hover:text-ink"
        >
          Use a different email
        </Link>
      </div>
    </div>
  );
}
