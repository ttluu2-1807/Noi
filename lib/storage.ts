"use client";

import { createClient } from "./supabase/client";

/**
 * Shape we persist on the `messages.attachments` jsonb column.
 * Kept minimal — anything extra (signed URLs, dimensions for layout
 * hints) is recomputed at render time.
 */
export interface Attachment {
  /** Storage path: `<family_space_id>/<uuid>.<ext>`. */
  path: string;
  /** MIME type as reported by the file. */
  mime: string;
  /** Original filename (for accessibility + fallback display). */
  name: string;
  /** Captured at upload time so the UI can reserve space and avoid layout shift. */
  width?: number;
  height?: number;
}

/**
 * Anthropic's vision API accepts JPEG, PNG, GIF, and WebP. We reject
 * everything else (in particular HEIC from iOS) before upload so we
 * don't fill storage with files Claude can't read.
 *
 * iOS Safari usually transcodes HEIC to JPEG when the user picks from
 * a file input with `accept="image/*"`, but it doesn't always — so we
 * surface a clear error instead of silently breaking the vision call.
 */
export const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — matches bucket limit

export type AllowedMime = (typeof ALLOWED_MIMES)[number];

function isAllowedMime(m: string): m is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(m);
}

/**
 * Upload a single image to the family's attachments folder. Returns
 * the metadata we store on the message. RLS on storage.objects
 * ensures the path's family_space_id segment matches the caller's
 * family, so the user can't accidentally upload into another family's
 * folder even if they tampered with the path.
 */
export async function uploadAttachment(
  file: File,
  familySpaceId: string,
): Promise<Attachment> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Image is too large. Maximum is 10 MB.");
  }
  if (!isAllowedMime(file.type)) {
    throw new Error(
      "Only JPG, PNG, WebP, and GIF images are supported. " +
        "If your photo is HEIC, on iPhone go to Settings → Camera → Formats → " +
        "'Most Compatible' so new photos save as JPG.",
    );
  }

  // Build path. crypto.randomUUID() is available in all modern browsers
  // and Node 19+ (we're on Node 22 in build, Vercel runtime same).
  const ext = file.name.split(".").pop()?.toLowerCase() ?? guessExt(file.type);
  const fileId = crypto.randomUUID();
  const path = `${familySpaceId}/${fileId}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const dims = await readImageDimensions(file).catch(() => null);

  return {
    path,
    mime: file.type,
    name: file.name,
    width: dims?.width,
    height: dims?.height,
  };
}

function guessExt(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Generate a short-lived signed URL for displaying an attachment in an
 * <img> tag. RLS still applies — only family members can mint URLs
 * for paths inside their family folder.
 *
 * Default expiry 1 hour. The image is cached by the browser, so a
 * stale URL after expiry is rarely a problem in practice — page
 * refresh re-mints.
 */
export async function getAttachmentSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Remove an uploaded attachment. Used when the user changes their mind
 * before sending, so we don't leak orphan storage objects.
 */
export async function deleteAttachment(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from("attachments").remove([path]);
}
