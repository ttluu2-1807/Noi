"use client";

import { useEffect, useRef, useState } from "react";
import { uploadAttachment, deleteAttachment, type Attachment } from "@/lib/storage";
import type { Language } from "@/lib/language-detect";

interface PhotographLetterProps {
  familySpaceId: string;
  language: Language;
  attachment: Attachment | null;
  onChange: (a: Attachment | null) => void;
  disabled?: boolean;
}

const T = {
  vi: {
    heading: "Hoặc chụp ảnh thư giấy tờ",
    subtitle:
      "Chụp thư hay hoá đơn — Noi sẽ đọc giúp và cho biết cần làm gì.",
    tap: "Chụp ảnh thư",
    uploading: "Đang tải ảnh...",
    remove: "Bỏ ảnh",
    ready: "Sẵn sàng — nhấn Gửi để Noi đọc.",
    fileError: "Không đọc được ảnh này. Vui lòng thử ảnh khác.",
    tooLarge: "Ảnh quá lớn. Kích thước tối đa 10 MB.",
  },
  en: {
    heading: "Or photograph a letter",
    subtitle: "Snap a letter or bill — Noi will read it and tell you what to do.",
    tap: "Photograph a letter",
    uploading: "Uploading photo…",
    remove: "Remove photo",
    ready: "Ready — tap Send and Noi will read it.",
    fileError: "That image couldn't be read. Try another.",
    tooLarge: "Image is too large. Max 10 MB.",
  },
} as const;

/**
 * Peer-of-the-mic photo capture surface. Per the audit, photograph-a-
 * letter is the killer feature that was previously buried behind a
 * small "Attach image" icon on the composer. This component elevates
 * it into a prominent tap-target on the home page, sized and coloured
 * so it feels equally primary to the mic — one voice path, one visual
 * path, either one starts an answer.
 *
 * When the user picks an image, it uploads immediately, we hand the
 * Attachment metadata to the caller via onChange, and swap to a
 * preview state. The caller (ParentHome) then sends the attachment
 * through the existing chat pipeline with a letter-mode prompt
 * substituted for the text.
 */
export function PhotographLetter({
  familySpaceId,
  language,
  attachment,
  onChange,
  disabled,
}: PhotographLetterProps) {
  const t = T[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const pick = () => {
    if (disabled || uploading || attachment) return;
    inputRef.current?.click();
  };

  const onFile = async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError(t.tooLarge);
      return;
    }
    // Show local preview immediately.
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setUploading(true);
    try {
      const att = await uploadAttachment(file, familySpaceId);
      onChange(att);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.fileError);
      URL.revokeObjectURL(preview);
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!attachment) return;
    const path = attachment.path;
    onChange(null);
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    await deleteAttachment(path).catch(() => {
      // ignore cleanup failures
    });
  };

  return (
    <section className="w-full rounded-card border border-line bg-gradient-to-br from-clay-wash/60 to-surface p-4 space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {!attachment && !uploading && (
        <button
          type="button"
          onClick={pick}
          disabled={disabled}
          className="flex w-full items-start gap-4 text-left active:scale-[0.99] transition-transform disabled:opacity-60 disabled:active:scale-100"
        >
          <span
            aria-hidden
            className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-full bg-clay text-white shadow-sm"
          >
            <CameraIcon />
          </span>
          <span className="min-w-0 flex-1 space-y-0.5">
            <span className="block text-body font-medium text-ink">
              {t.heading}
            </span>
            <span className="block text-body-sm text-ink-3">{t.subtitle}</span>
          </span>
        </button>
      )}

      {uploading && (
        <div className="flex items-center gap-3">
          <span className="inline-block h-4 w-4 rounded-full bg-clay animate-pulse" />
          <span className="text-body-sm text-ink-3">{t.uploading}</span>
        </div>
      )}

      {attachment && localPreview && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={localPreview}
            alt="Letter preview"
            className="h-16 w-16 shrink-0 rounded-control object-cover border border-line"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-body-sm text-ink">{t.ready}</p>
            <button
              type="button"
              onClick={remove}
              className="text-body-sm text-clay-deep underline underline-offset-2 hover:opacity-80"
            >
              {t.remove}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
      />
      <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
