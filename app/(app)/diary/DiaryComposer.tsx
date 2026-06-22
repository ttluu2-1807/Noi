"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VoiceInput } from "@/components/VoiceInput";
import { LoadingDots } from "@/components/LoadingDots";
import { TagSelector } from "@/components/TagSelector";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import type { Attachment } from "@/lib/storage";
import type { Language } from "@/lib/language-detect";
import {
  createDiaryEntry,
  updateDiaryEntry,
  extractDiaryFromVoice,
  type DiaryKind,
} from "./actions";

interface DiaryComposerProps {
  mode: "new" | "edit";
  /** Pre-filled values for edit mode. */
  initialId?: string;
  initialKind?: DiaryKind;
  initialTitle?: string;
  initialBody?: string | null;
  initialContext?: string | null;
  initialEventDate?: string | null;
  initialTags?: string[];
  initialAttachments?: Attachment[];
  /** Tags currently in use across the family — feeds autocomplete. */
  familyTags: string[];
  familySpaceId: string;
  language: Language;
}

const T = {
  vi: {
    titleLabel: "Tiêu đề",
    titlePlaceholder: "Tóm tắt trong một câu",
    kindLabel: "Đây là gì?",
    kindEvent: "Sự kiện",
    kindDecision: "Quyết định",
    kindNote: "Ghi chú",
    bodyLabel: "Nội dung",
    bodyPlaceholder: "Đã xảy ra chuyện gì / quyết định gì?",
    contextLabel: "Vì sao? (không bắt buộc)",
    contextPlaceholder:
      "Tại sao quyết định như vậy? Đã cân nhắc gì khác? Sau này muốn nhớ lại điều gì?",
    contextExpand: "+ Thêm 'vì sao' / bối cảnh",
    dateLabel: "Ngày diễn ra (không bắt buộc)",
    dateExpand: "+ Thêm ngày",
    photosLabel: "Ảnh đính kèm (không bắt buộc)",
    voiceHint: "Nhấn micro để đọc nội dung.",
    cancel: "Huỷ",
    save: "Lưu",
    saving: "Đang lưu…",
    translating: "Đang dịch và lưu…",
    titleRequired: "Vui lòng nhập tiêu đề.",
  },
  en: {
    titleLabel: "Title",
    titlePlaceholder: "A one-line summary",
    kindLabel: "What is this?",
    kindEvent: "Event",
    kindDecision: "Decision",
    kindNote: "Note",
    bodyLabel: "What happened / what was decided",
    bodyPlaceholder: "Describe in plain language.",
    contextLabel: "Why? (optional)",
    contextPlaceholder:
      "What were you trying to achieve? What did you consider and reject? What might future-you want to remember?",
    contextExpand: "+ Add 'why' or context",
    dateLabel: "Date this happened (optional)",
    dateExpand: "+ Add date",
    photosLabel: "Photos (optional)",
    voiceHint: "Tap the mic to dictate.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    translating: "Translating and saving…",
    titleRequired: "Please enter a title.",
  },
} as const;

/**
 * Compose-or-edit a diary entry. Three kinds (event / decision / note)
 * share one form; the kind chip subtly emphasises different fields:
 *
 *   - Event: date field auto-expanded, photos prompt visible
 *   - Decision: context ("why") auto-expanded with a guiding placeholder
 *   - Note: only the basics visible, optionals collapsed
 *
 * Translation happens server-side at write time. The user types in
 * their preferred language; Claude fills the other-language columns.
 */
export function DiaryComposer({
  mode,
  initialId,
  initialKind = "note",
  initialTitle = "",
  initialBody = null,
  initialContext = null,
  initialEventDate = null,
  initialTags = [],
  initialAttachments = [],
  familyTags,
  familySpaceId,
  language,
}: DiaryComposerProps) {
  const t = T[language];
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [kind, setKind] = useState<DiaryKind>(initialKind);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody ?? "");
  const [context, setContext] = useState(initialContext ?? "");
  const [eventDate, setEventDate] = useState(initialEventDate ?? "");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [singleAttachment, setSingleAttachment] = useState<Attachment | null>(null);

  // Reveal state — defaults adapt to kind so a decision opens with the
  // context expanded, an event with the date expanded.
  const [contextOpen, setContextOpen] = useState(
    !!initialContext || initialKind === "decision",
  );
  const [dateOpen, setDateOpen] = useState(
    !!initialEventDate || initialKind === "event",
  );

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Watch kind changes to update the smart defaults — but only when the
  // user hasn't explicitly expanded/collapsed already (track via the
  // values themselves: if a context exists, keep it open).
  const onKindChange = (next: DiaryKind) => {
    setKind(next);
    if (next === "decision" && !contextOpen) setContextOpen(true);
    if (next === "event" && !dateOpen) setDateOpen(true);
  };

  const onSave = () => {
    if (!title.trim()) {
      setError(t.titleRequired);
      titleRef.current?.focus();
      return;
    }
    setError(null);

    // Sync the single attachment picker into the attachments array.
    const allAttachments = [
      ...attachments,
      ...(singleAttachment ? [singleAttachment] : []),
    ];

    startTransition(async () => {
      const result =
        mode === "new"
          ? await createDiaryEntry({
              kind,
              title: title.trim(),
              body: body.trim() || null,
              context: context.trim() || null,
              event_date: eventDate || null,
              tags,
              attachments: allAttachments,
              related_thread_id: null,
            })
          : await updateDiaryEntry({
              id: initialId!,
              kind,
              title: title.trim(),
              body: body.trim() || null,
              context: context.trim() || null,
              event_date: eventDate || null,
              tags,
              attachments: allAttachments,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      const id = mode === "new" && "id" in result ? result.id : initialId!;
      router.push(`/diary/${id}`);
    });
  };

  // TagSelector wants an async setter that returns Result; we update
  // local state and resolve OK. The actual persistence happens on Save.
  const localTagsSetter = async (
    _id: string,
    next: string[],
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setTags(next);
    return { ok: true };
  };

  return (
    <div className="space-y-6">
      {/* Kind selector */}
      <section className="space-y-2">
        <label className="text-sm text-muted">{t.kindLabel}</label>
        <div className="flex flex-wrap gap-2">
          {(["event", "decision", "note"] as DiaryKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKindChange(k)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all active:scale-95 ${
                kind === k
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-white text-ink hover:border-accent/40"
              }`}
            >
              {kindLabel(k, t)}
            </button>
          ))}
        </div>
      </section>

      {/* Voice dictation — routes the transcript through Claude to
          extract structured fields (kind, title, body, context, date,
          tags) rather than dumping into the body. On any failure we
          fall back to the old behaviour so the user never loses their
          words. */}
      <section className="rounded-card border border-line bg-white p-4 space-y-3">
        <p className="text-xs text-muted">{t.voiceHint}</p>
        <VoiceInput
          language={language}
          onTranscript={async (transcript) => {
            const trimmed = transcript.trim();
            if (!trimmed) return;
            setExtracting(true);
            try {
              const result = await extractDiaryFromVoice(trimmed);
              if (result.ok) {
                const e = result.extracted;
                onKindChange(e.kind);
                setTitle(e.title);
                if (e.body) setBody(e.body);
                if (e.context) {
                  setContext(e.context);
                  setContextOpen(true);
                }
                if (e.event_date) {
                  setEventDate(e.event_date);
                  setDateOpen(true);
                }
                if (e.tags.length > 0) {
                  // Merge into existing tags rather than overwrite, in
                  // case the user already set some.
                  setTags((prev) =>
                    Array.from(new Set([...prev, ...e.tags])),
                  );
                }
              } else {
                // Extraction failed — keep the words. Drop the
                // transcript into body so the user still has something
                // to work with.
                setBody(trimmed);
                bodyRef.current?.focus();
              }
            } catch {
              setBody(trimmed);
              bodyRef.current?.focus();
            } finally {
              setExtracting(false);
            }
          }}
        />
        {extracting && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <LoadingDots />
            {language === "vi"
              ? "Đang sắp xếp các trường…"
              : "Sorting that into fields…"}
          </div>
        )}
      </section>

      {/* Title */}
      <section className="space-y-2">
        <label className="block text-sm text-muted">{t.titleLabel}</label>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.titlePlaceholder}
          disabled={pending}
          className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none"
        />
      </section>

      {/* Body */}
      <section className="space-y-2">
        <label className="block text-sm text-muted">{t.bodyLabel}</label>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder={t.bodyPlaceholder}
          disabled={pending}
          className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none resize-none"
        />
      </section>

      {/* Why / context — collapsed by default for note/event, open for decision */}
      {contextOpen ? (
        <section className="space-y-2">
          <label className="block text-sm text-muted">{t.contextLabel}</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            placeholder={t.contextPlaceholder}
            disabled={pending}
            className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none resize-none"
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setContextOpen(true)}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          {t.contextExpand}
        </button>
      )}

      {/* Date — collapsed by default for note/decision, open for event */}
      {dateOpen ? (
        <section className="space-y-2">
          <label className="block text-sm text-muted">{t.dateLabel}</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            disabled={pending}
            className="rounded-card border border-line bg-white px-4 py-2 focus:border-accent focus:outline-none"
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setDateOpen(true)}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          {t.dateExpand}
        </button>
      )}

      {/* Tags */}
      <section className="space-y-2">
        <TagSelector
          threadId="diary-draft"
          tags={tags}
          familyTags={familyTags}
          language={language}
          onSetTags={localTagsSetter}
        />
      </section>

      {/* Single-photo attachment for now — same picker the parent home + child
          composer use, sharing the existing storage bucket and upload UX. */}
      <section className="space-y-2">
        <label className="block text-sm text-muted">{t.photosLabel}</label>
        <AttachmentPicker
          familySpaceId={familySpaceId}
          language={language}
          attachment={singleAttachment}
          onChange={setSingleAttachment}
          disabled={pending}
        />
      </section>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          {t.cancel}
        </button>
        <div className="flex items-center gap-3">
          {pending && <LoadingDots />}
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !title.trim()}
            className="rounded-card bg-accent px-5 py-3 font-medium text-white disabled:opacity-40 hover:opacity-90 transition-transform active:scale-[0.98]"
          >
            {pending ? t.translating : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function kindLabel(k: DiaryKind, t: (typeof T)[Language]): string {
  switch (k) {
    case "event":
      return t.kindEvent;
    case "decision":
      return t.kindDecision;
    case "note":
      return t.kindNote;
  }
}
