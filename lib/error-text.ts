import type { Language } from "./language-detect";

/**
 * Localised, warm error text. We never surface raw Supabase / Anthropic
 * / network errors to a parent — they're frightening and unhelpful.
 * Instead we lump errors into a few buckets and present each in the
 * user's language with reassurance ("your family member can help").
 *
 * Server actions that touch the parent flow should map their failures
 * to one of these buckets before returning to the client.
 */
export type ErrorKind =
  | "generic" // catch-all
  | "network" // request failed, may be offline
  | "rateLimit" // too many requests too fast
  | "auth" // session expired, need to sign in again
  | "imageTooLarge" // upload too big
  | "imageType"; // unsupported image format

const T: Record<Language, Record<ErrorKind, string>> = {
  vi: {
    generic:
      "Đã có lỗi xảy ra. Quý vị vui lòng thử lại — nếu vẫn không được, con của quý vị sẽ giúp.",
    network:
      "Có vẻ kết nối mạng đang chậm. Quý vị thử lại sau một chút nhé.",
    rateLimit:
      "Quý vị đang hỏi hơi nhanh. Vui lòng đợi một chút rồi thử lại.",
    auth:
      "Quý vị cần đăng nhập lại. Vui lòng vào lại từ liên kết trong email.",
    imageTooLarge:
      "Ảnh hơi lớn. Quý vị thử chụp lại nhỏ hơn hoặc nhờ con giúp.",
    imageType:
      "Định dạng ảnh chưa hỗ trợ. Quý vị thử ảnh JPG hoặc PNG nhé.",
  },
  en: {
    generic:
      "Something went wrong. Please try again — if it keeps happening, ask your family member to help.",
    network:
      "Your connection looks slow. Try again in a moment.",
    rateLimit:
      "You're going a bit fast. Please wait a moment and try again.",
    auth: "Please sign in again from the link in your email.",
    imageTooLarge:
      "That image is a bit large. Try a smaller one or ask a family member to help.",
    imageType: "That image format isn't supported. Try a JPG or PNG.",
  },
};

export function friendlyError(kind: ErrorKind, language: Language): string {
  return T[language][kind];
}

/**
 * Map a raw error string / Error to one of the buckets above.
 * Defensive — never throws, always returns SOMETHING.
 */
export function classifyError(err: unknown): ErrorKind {
  const s =
    err instanceof Error
      ? err.message.toLowerCase()
      : typeof err === "string"
        ? err.toLowerCase()
        : "";
  if (!s) return "generic";
  if (s.includes("rate") || s.includes("429") || s.includes("too many")) return "rateLimit";
  if (s.includes("network") || s.includes("fetch") || s.includes("offline")) return "network";
  if (s.includes("auth") || s.includes("401") || s.includes("expired")) return "auth";
  if (s.includes("too large") || s.includes("10 mb") || s.includes("size")) return "imageTooLarge";
  if (s.includes("supported") || s.includes("heic") || s.includes("mime")) return "imageType";
  return "generic";
}
