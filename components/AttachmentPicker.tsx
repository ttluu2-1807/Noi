"use client";

import { useEffect, useRef, useState } from "react";
import { uploadAttachment, deleteAttachment, type Attachment } from "@/lib/storage";
import type { Language } from "@/lib/language-detect";

interface AttachmentPickerProps {
  familySpaceId: string;
  language: Language;
  attachment: Attachment | null;
  onChange: (a: Attachment | null) => void;
  disabled?: boolean;
}

const T = {
  vi: {
    add: "Đính kèm ảnh",
    uploading: "Đang tải lên...",
    remove: "Bỏ ảnh",
    hint:
      "Có thư từ, hoá đơn, hoặc màn hình bị lỗi? Chụp ảnh và gửi để Noi giải thích giúp.",
  },
  en: {
    add: "Attach image",
    uploading: "Uploading…",
    remove: "Remove image",
    hint:
      "Got a letter, bill, or confusing screen? Upload a photo and Noi can read it.",
  },
} as const;

/**
 * Photo / screenshot uploader for composers. The user picks a file,
 * we upload immediately, hold the path in local state, and pass it
 * to the parent component via `onChange`. The parent includes the
 * attachment metadata in its send action (`/api/chat` body or the
 * `replyToThread` server action).
 *
 * If the user removes the attachment before sending, we delete the
 * storage object so we don't leak orphans.
 */
export function AttachmentPicker({
  familySpaceId,
  language,
  attachment,
  onChange,
  disabled,
}: AttachmentPickerProps) {
  const t = T[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Free object URLs when component unmounts or preview changes.
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const handlePick = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later by clearing the value.
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    const blobUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(blobUrl);

    try {
      const uploaded = await uploadAttachment(file, familySpaceId);
      onChange(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      onChange(null);
      URL.revokeObjectURL(blobUrl);
      setLocalPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (attachment) {
      // Best-effort cleanup — don't block UI on it.
      deleteAttachment(attachment.path).catch(() => {});
    }
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    onChange(null);
  };

  const previewUrl = localPreviewUrl;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />

      {!previewUrl && !attachment && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={handlePick}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1.5 rounded-card border border-line bg-white px-3 py-2 text-sm text-muted hover:text-ink hover:border-accent/40 transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            {t.add}
          </button>
          <p className="text-xs text-muted/80">{t.hint}</p>
        </div>
      )}

      {(previewUrl || attachment) && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? ""}
            alt={attachment?.name ?? "Attached image"}
            className="h-24 w-24 rounded-card object-cover border border-line"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-card bg-black/50 text-xs text-white">
              {t.uploading}
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label={t.remove}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-line text-muted hover:text-ink shadow"
            >
              ×
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
