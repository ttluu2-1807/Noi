"use client";

import { useEffect, useRef, useState } from "react";
import { tagColors, normaliseTag } from "@/lib/tags";
import type { Language } from "@/lib/language-detect";

interface LocalTagsInputProps {
  /** Current tag set — fully controlled by parent. */
  value: string[];
  /** Called with the next full tag array on any add/remove. */
  onChange: (next: string[]) => void;
  /** Other tags used elsewhere in this family — autocomplete suggestions. */
  familyTags: string[];
  language: Language;
  disabled?: boolean;
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
 * Local-state multi-tag input. Same visual as TagSelector but managed
 * entirely in the parent's React state — no server action baked in,
 * no threadId. Used by TodoComposer + TodoEditForm where the tags
 * ride along in a form submission rather than a per-change save.
 */
export function LocalTagsInput({
  value,
  onChange,
  familyTags,
  language,
  disabled,
}: LocalTagsInputProps) {
  const t = T[language];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const addTag = (raw: string) => {
    const n = normaliseTag(raw);
    if (!n) return;
    if (value.includes(n)) return;
    onChange([...value, n]);
    setDraft("");
    setAdding(false);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((x) => x !== tag));
  };

  const suggestions = familyTags.filter(
    (ft) =>
      !value.includes(ft) &&
      (draft.trim() === "" || ft.includes(normaliseTag(draft))),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-body-sm text-muted">{t.label}</span>

      {value.map((tag) => {
        const c = tagColors(tag);
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-body-sm animate-pop-in"
            style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
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
          disabled={disabled}
          className="rounded-full border border-dashed border-line bg-white px-2 py-0.5 text-body-sm text-muted hover:text-ink hover:border-accent/40 transition-colors active:scale-95 disabled:opacity-40"
        >
          + {t.add}
        </button>
      )}

      {adding && (
        <div className="relative">
          <div className="inline-flex items-center gap-1 rounded-full border border-accent bg-white pl-2 pr-1 py-0.5 text-body-sm">
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
              <span className="w-full text-body-sm text-muted/80 mb-1">
                {t.suggestions}
              </span>
              {suggestions.slice(0, 12).map((s) => {
                const c = tagColors(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="rounded-full border px-2 py-0.5 text-body-sm hover:opacity-80 active:scale-95"
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
