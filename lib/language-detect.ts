/**
 * Heuristic language detection for the dual-language pipeline.
 *
 * Rule: if the input contains at least one Vietnamese diacritical or
 * Vietnamese-specific letter, treat it as Vietnamese. Otherwise English.
 *
 * This is intentionally simple — it handles the common case well
 * (parent speaks/types Vietnamese; child types English) and avoids
 * the weight of a full language-detection model. A single diacritic
 * is a strong signal because English does not use them.
 */

// All Vietnamese-specific characters: diacritics plus đ/Đ.
// Built once at module load.
const VI_CHARS = new RegExp(
  "[" +
    // a
    "àáảãạăằắẳẵặâầấẩẫậ" +
    // e
    "èéẻẽẹêềếểễệ" +
    // i
    "ìíỉĩị" +
    // o
    "òóỏõọôồốổỗộơờớởỡợ" +
    // u
    "ùúủũụưừứửữự" +
    // y
    "ỳýỷỹỵ" +
    // d
    "đ" +
    // uppercase forms
    "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ" +
    "ÈÉẺẼẸÊỀẾỂỄỆ" +
    "ÌÍỈĨỊ" +
    "ÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ" +
    "ÙÚỦŨỤƯỪỨỬỮỰ" +
    "ỲÝỶỸỴ" +
    "Đ" +
    "]",
);

export type Language = "vi" | "en";

export function detectLanguage(input: string): Language {
  return VI_CHARS.test(input) ? "vi" : "en";
}

export function otherLanguage(lang: Language): Language {
  return lang === "vi" ? "en" : "vi";
}
