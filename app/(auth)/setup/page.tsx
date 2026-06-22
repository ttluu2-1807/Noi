"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { completeSetup } from "./actions";

export default function SetupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const [role, setRole] = useState<"parent" | "child" | "">("");
  const [mode, setMode] = useState<"new" | "join">("new");

  // The "join" choice always means "we already have a family on Noi" —
  // every role can do it (second parent, sibling). Only the very first
  // person setting up a family picks "new". Default depends on role:
  // parents almost always join (their child set up the family first),
  // children almost always start new (they're the family creator).
  const onRoleChange = (next: "parent" | "child") => {
    setRole(next);
    setMode(next === "parent" ? "join" : "new");
  };

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
            Are you a parent, or a family member helping out?
          </legend>

          <label className="block cursor-pointer rounded-card border border-line bg-white p-5 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5">
            <div className="flex items-start gap-4">
              <input
                type="radio"
                name="role"
                value="parent"
                required
                checked={role === "parent"}
                onChange={() => onRoleChange("parent")}
                className="mt-1 h-4 w-4 accent-[#1D9E75]"
              />
              <div>
                <div className="font-medium">I&apos;m a parent</div>
                <div className="text-sm text-muted mt-1">
                  Tôi là ba hoặc mẹ. Tôi sẽ nhận mã gia đình từ con.
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
                checked={role === "child"}
                onChange={() => onRoleChange("child")}
                className="mt-1 h-4 w-4 accent-[#1D9E75]"
              />
              <div>
                <div className="font-medium">I&apos;m helping my parents</div>
                <div className="text-sm text-muted mt-1">
                  You&apos;ll get a code to share with them and any siblings.
                </div>
              </div>
            </div>
          </label>
        </fieldset>

        {role && (
          <fieldset className="space-y-3">
            <legend className="text-sm text-muted mb-2">
              {role === "parent"
                ? "Has someone already set up your family on Noi?"
                : "Are you the first one setting up, or joining a family that exists?"}
            </legend>

            <label className="block cursor-pointer rounded-card border border-line bg-white p-4 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5">
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="mode"
                  value="new"
                  checked={mode === "new"}
                  onChange={() => setMode("new")}
                  className="mt-1 h-4 w-4 accent-[#1D9E75]"
                />
                <div className="text-sm">
                  <div className="font-medium text-ink">Start a new family</div>
                  <div className="text-muted mt-0.5">
                    Noi will create a 6-character code you can share.
                  </div>
                </div>
              </div>
            </label>

            <label className="block cursor-pointer rounded-card border border-line bg-white p-4 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5">
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="mode"
                  value="join"
                  checked={mode === "join"}
                  onChange={() => setMode("join")}
                  className="mt-1 h-4 w-4 accent-[#1D9E75]"
                />
                <div className="text-sm flex-1 min-w-0">
                  <div className="font-medium text-ink">Join an existing family</div>
                  <div className="text-muted mt-0.5 mb-3">
                    {role === "parent"
                      ? "Enter the code your child or partner shared."
                      : "Enter the code a parent or sibling shared with you."}
                  </div>
                  {mode === "join" && (
                    <input
                      name="code"
                      type="text"
                      required
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="6-character code"
                      className="w-full rounded-card border border-line bg-white px-3 py-2 text-base tracking-widest uppercase focus:border-accent focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </label>
          </fieldset>
        )}

        {searchParams.error && (
          <p className="text-sm text-red-600" role="alert">
            {searchParams.error}
          </p>
        )}

        <SubmitButton
          pendingLabel="Setting up…"
          className="w-full rounded-card bg-accent px-4 py-3 font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Continue
        </SubmitButton>
      </form>
    </div>
  );
}
