import Link from "next/link";
import { sendMagicLink } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Noi</h1>
        <p className="text-muted">Sign in with your email. We&apos;ll send you a link.</p>
      </div>

      <form action={sendMagicLink} className="space-y-4">
        <label className="block">
          <span className="sr-only">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-card border border-line bg-white px-4 py-3 text-base focus:border-accent focus:outline-none"
          />
        </label>

        {searchParams.error && (
          <p className="text-sm text-red-600" role="alert">
            {searchParams.error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-card bg-accent px-4 py-3 font-medium text-white hover:opacity-90 transition-opacity"
        >
          Send me a login link
        </button>
      </form>

      <div className="text-center text-sm text-muted">
        Have a family invite code?{" "}
        <Link href="/join" className="text-accent hover:underline">
          Join a family
        </Link>
      </div>
    </div>
  );
}
