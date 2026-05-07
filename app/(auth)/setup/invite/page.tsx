import Link from "next/link";
import { redirect } from "next/navigation";

export default function InviteCodePage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code;
  if (!code) redirect("/setup");

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-3">
        <h1 className="text-2xl font-medium">Share this with your parent</h1>
        <p className="text-muted">
          Send them this code so they can join your family space.
        </p>
      </div>

      <div className="rounded-card border border-line bg-white p-8">
        <div className="text-sm text-muted mb-2">Family code</div>
        <div className="text-4xl font-medium tracking-widest text-accent">
          {code}
        </div>
      </div>

      <Link
        href="/child"
        className="inline-block w-full rounded-card bg-accent px-4 py-3 font-medium text-white hover:opacity-90 transition-opacity"
      >
        Continue to dashboard
      </Link>

      <p className="text-xs text-muted">
        You can find this code again in Settings later.
      </p>
    </div>
  );
}
