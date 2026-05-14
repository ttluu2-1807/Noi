"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Language } from "@/lib/language-detect";

export interface ChecklistRow {
  id: string;
  text_vi: string;
  text_en: string;
  is_completed: boolean;
  sort_order: number;
}

interface ChecklistPanelProps {
  items: ChecklistRow[];
  language: Language;
  currentUserId: string;
}

/**
 * Renders a tick-off checklist. Completion state is optimistic on click,
 * then persisted. Works for both parent (bigger tap target) and child
 * (same, but no-op difference at the layout level — parent just inherits
 * the 18px body size from the ParentLayout wrapper).
 */
export function ChecklistPanel({ items, language, currentUserId }: ChecklistPanelProps) {
  const [rows, setRows] = useState(items);
  // Track which row was JUST toggled-to-complete so we can play the
  // green flash animation on it. We clear it after ~1s so a re-toggle
  // can play it again.
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (rows.length === 0) return null;

  const toggle = (row: ChecklistRow) => {
    const next = !row.is_completed;

    // Optimistic update.
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_completed: next } : r)),
    );

    // Only celebrate ticks (not un-ticks).
    if (next) {
      setCelebratingId(row.id);
      setTimeout(() => setCelebratingId((id) => (id === row.id ? null : id)), 800);
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("checklist_items")
        .update({
          is_completed: next,
          completed_by: next ? currentUserId : null,
          completed_at: next ? new Date().toISOString() : null,
        })
        .eq("id", row.id);

      if (error) {
        // Roll back on failure.
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, is_completed: !next } : r,
          ),
        );
        setCelebratingId(null);
      }
    });
  };

  return (
    <ul className="space-y-2">
      {rows
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((row) => {
          const label = language === "vi" ? row.text_vi : row.text_en;
          return (
            <li key={row.id}>
              <label
                className={`flex cursor-pointer items-start gap-4 rounded-card border border-line bg-white p-4 transition-colors has-[:checked]:border-accent/60 has-[:checked]:bg-accent/5 ${
                  celebratingId === row.id ? "animate-tick-flash" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={row.is_completed}
                  onChange={() => toggle(row)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#1D9E75] transition-transform active:scale-90"
                  aria-label={label}
                />
                <span
                  className={`leading-relaxed transition-colors ${
                    row.is_completed ? "text-muted line-through" : "text-ink"
                  }`}
                >
                  {label}
                </span>
              </label>
            </li>
          );
        })}
    </ul>
  );
}
