import { SubmitButton } from "@/components/SubmitButton";
import { joinFamily } from "./actions";

export default function JoinPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Join your family</h1>
        <p className="text-muted">Enter the 6-character code your family shared with you.</p>
      </div>

      <form action={joinFamily} className="space-y-4">
        <label className="block">
          <span className="sr-only">Family code</span>
          <input
            name="code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
            maxLength={8}
            placeholder="ABC123"
            className="w-full rounded-card border border-line bg-white px-4 py-4 text-center text-2xl font-medium tracking-widest uppercase focus:border-accent focus:outline-none"
          />
        </label>

        {searchParams.error && (
          <p className="text-sm text-red-600" role="alert">
            {searchParams.error}
          </p>
        )}

        <SubmitButton
          pendingLabel="Joining…"
          className="w-full rounded-card bg-accent px-4 py-3 font-medium text-white hover:opacity-90"
        >
          Join
        </SubmitButton>
      </form>
    </div>
  );
}
