"use client";

import { useState } from "react";

export function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Fine — older browsers won't get the feedback but the code is visible.
        }
      }}
      className="group inline-flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2 hover:border-accent/40 transition-colors"
    >
      <span className="text-2xl font-medium tracking-widest text-accent">
        {code}
      </span>
      <span className="text-xs text-muted group-hover:text-ink">
        {copied ? "Copied!" : "Tap to copy"}
      </span>
    </button>
  );
}
