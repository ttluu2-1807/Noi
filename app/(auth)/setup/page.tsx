import { SubmitButton } from "@/components/SubmitButton";
import { completeSetup } from "./actions";

export default function SetupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Welcome</h1>
        <p className="text-muted">A few quick questions to set up your space.</p>
      </div>

      <form action={completeSetup} className="space-y-6">
        <label className="block space-y-2">
          <span className="text-sm text-muted">Your name</span>
          <input
            name="name"
            type="text"
            required
            autoComplete="given-name"
            placeholder="e.g. Mai"
            className="w-full rounded-card border border-line bg-white px-4 py-3 text-base focus:border-accent focus:outline-none"
          />
        </label>

        <fieldset className="space-y-3">
          <legend className="text-sm text-muted mb-2">
            Are you the parent, or a family member helping out?
          </legend>

          <label className="block cursor-pointer rounded-card border border-line bg-white p-5 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5">
            <div className="flex items-start gap-4">
              <input
                type="radio"
                name="role"
                value="parent"
                required
                className="mt-1 h-4 w-4 accent-[#1D9E75]"
              />
              <div>
                <div className="font-medium">I&apos;m the parent</div>
                <div className="text-sm text-muted mt-1">
                  Tôi là ba / mẹ. Tôi sẽ nhận mã gia đình từ con tôi.
                </div>
              </div>
            </div>
          </label>

          <label className="block cursor-pointer rounded-card border border-line bg-white p-5 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5">
            <div className="flex items-start gap-4">
              <input
                type="radio"
                name="role"
                value="child"
                className="mt-1 h-4 w-4 accent-[#1D9E75]"
              />
              <div>
                <div className="font-medium">I&apos;m helping my parent</div>
                <div className="text-sm text-muted mt-1">
                  You&apos;ll get a code to share with them.
                </div>
              </div>
            </div>
          </label>
        </fieldset>

        {searchParams.error && (
          <p className="text-sm text-red-600" role="alert">
            {searchParams.error}
          </p>
        )}

        <SubmitButton
          pendingLabel="Setting up…"
          className="w-full rounded-card bg-accent px-4 py-3 font-medium text-white hover:opacity-90"
        >
          Continue
        </SubmitButton>
      </form>
    </div>
  );
}
