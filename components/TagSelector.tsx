"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { tagColors, normaliseTag } from "@/lib/tags";
import type { Language } from "@/lib/language-detect";

interface TagSelectorProps {
  threadId: string;
  /** Current tag set on this thread (server-fetched). */
  tags: string[];
  /** Other tags used elsewhere in this family — shown as autocomplete suggestions. */
  familyTags: string[];
  language: Language;
  /**
   * Server Action that persists the full updated tag array for this
   * thread. Must be importable as a Server Action (with the parent
   * file's "use server" directive) so it can cross the server/client
   * boundary as a prop.
   */
  onSetTags: (
    threadId: string,
    tags: string[],
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const T = {
  vi: {
    label: "Thẻ:",
    add: "Thêm thẻ",
    placeholder: "Tên thẻ mới",
    suggestions: "Đề xuất",
    save: "Thêm",
    cancel: "Huỷ",
  },
  en: {
    label: "Tags:",
    add: "Add tag",
    placeholder: "New tag name",
    suggestions: "Suggestions",
    save: "Add",
    cancel: "Cancel",
  },
} as const;

/**
 * Multi-tag input. Renders each current tag as a coloured pill with an
 * × button. "Add tag" opens an inline composer with:
 *   - autocomplete from `familyTags` (tags used elsewhere in the family)
 *   - free-text entry for new tags
 *
 * Both roles can use it — same component on parent thread + child thread
 * views. All edits go through `onChange(next)` which the parent wires to
 * a Server Action that writes the whole tag array.
 *
 * Optimistic: pill appears/disappears immediately, rolls back on error.
 */
export function TagSelector({
  threadId,
  tags,
  familyTags,
  language,
  onSetTags,
}: TagSelectorProps) {
  const t = T[language];
  const [local, setLocal] = useState<string[]>(tags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from props when server data updates (after revalidate).
  useEffect(() => {
    setLocal(tags);
  }, [tags]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const persist = (next: string[]) => {
    const before = local;
    setLocal(next);
    startTransition(async () => {
      try {
        const r = await onSetTags(threadId, next);
        if (!r.ok) setLocal(before);
      } catch {
        setLocal(before); // roll back on failure
      }
    });
  };

  const addTag = (raw: string) => {
    const n = normaliseTag(raw);
    if (!n) return;
    if (local.includes(n)) return;
    persist([...local, n]);
    setDraft("");
    setAdding(false);
  };

  const removeTag = (tag: string) => {
    persist(local.filter((x) => x !== tag));
  };

  // Show suggestions = family tags not already on this thread, filtered
  // by current draft input.
  const suggestions = familyTags.filter(
    (ft) =>
      !local.includes(ft) &&
      (draft.trim() === "" || ft.includes(normaliseTag(draft))),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">{t.label}</span>

      {local.map((tag) => {
        const c = tagColors(tag);
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="opacity-70 hover:opacity-100 active:scale-95 transition-transform leading-none -mr-0.5"
            >
              ×
            </button>
          </span>
        );
      })}

      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-line bg-white px-2 py-0.5 text-xs text-muted hover:text-ink hover:border-accent/40 transition-colors active:scale-95"
        >
          + {t.add}
        </button>
      )}

      {adding && (
        <div className="relative">
          <div className="inline-flex items-center gap-1 rounded-full border border-accent bg-white pl-2 pr-1 py-0.5 text-xs">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(draft);
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder={t.placeholder}
              className="bg-transparent outline-none w-32"
            />
            <button
              type="button"
              onClick={() => addTag(draft)}
              disabled={!draft.trim()}
              className="text-accent disabled:opacity-30 hover:opacity-80 active:scale-95"
            >
              {t.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft("");
              }}
              aria-label={t.cancel}
              className="text-muted hover:text-ink active:scale-95"
            >
              ×
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-20 max-w-xs flex flex-wrap gap-1 rounded-card border border-line bg-white p-2 shadow-sm">
              <span className="w-full text-xs text-muted/80 mb-1">
                {t.suggestions}
              </span>
              {suggestions.slice(0, 12).map((s) => {
                const c = tagColors(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="rounded-full border px-2 py-0.5 text-xs hover:opacity-80 active:scale-95"
                    style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
