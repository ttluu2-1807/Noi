import Link from "next/link";
import { resendMagicLink } from "./actions";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { email?: string; resent?: string };
}) {
  const email = searchParams.email ?? "your email";

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-3">
        <div
          aria-hidden
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-8 w-8 text-accent"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-medium">Check your email</h1>
        <p className="text-muted">
          We sent a link to <span className="text-ink">{email}</span>. Tap it to open Noi.
        </p>
      </div>

      {searchParams.resent && (
        <p className="text-sm text-accent">A new link is on the way.</p>
      )}

      <form action={resendMagicLink} className="space-y-2">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          className="text-sm text-muted hover:text-ink underline underline-offset-4"
        >
          Resend link
        </button>
      </form>

      <Link href="/login" className="block text-sm text-muted hover:text-ink">
        Use a different email
      </Link>
    </div>
  );
}
