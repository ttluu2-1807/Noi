"use client";

import { useState, useTransition } from "react";
import { setThreadCategory } from "./actions";

interface CategorySelectorProps {
  threadId: string;
  current: string | null;
}

// The preset shortlist from the schema comment. The DB column is free-form,
// so the user could type any string, but presets keep the taxonomy tidy.
const PRESETS = [
  "medicare",
  "tax",
  "banking",
  "utilities",
  "appointments",
  "legal",
  "other",
] as const;

export function CategorySelector({ threadId, current }: CategorySelectorProps) {
  const [value, setValue] = useState(current ?? "");
  const [pending, startTransition] = useTransition();

  const save = (next: string) => {
    setValue(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("threadId", threadId);
      fd.set("category", next);
      await setThreadCategory(fd);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Category:</span>
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          disabled={pending}
          onClick={() => save(value === p ? "" : p)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
            value === p
              ? "bg-accent text-white"
              : "bg-white border border-line text-muted hover:text-ink"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
