import type { Language } from "./language-detect";

/**
 * Time-of-day greeting. Computed from the current Date — should be
 * called from a Client Component so it picks up the user's local hour,
 * not the server's. Renders as the leading word of the parent's home
 * header ("Chào buổi sáng, Mai"), making the app feel attentive.
 *
 * Windows:
 *   05:00–11:59 → morning
 *   12:00–17:59 → afternoon
 *   18:00–21:59 → evening
 *   22:00–04:59 → late / generic
 */
export function timeOfDayGreeting(name: string, language: Language, date = new Date()): string {
  const hour = date.getHours();
  const part: "morning" | "afternoon" | "evening" | "late" =
    hour >= 5 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 18
        ? "afternoon"
        : hour >= 18 && hour < 22
          ? "evening"
          : "late";

  const map = {
    vi: {
      morning: `Chào buổi sáng, ${name}`,
      afternoon: `Chào buổi chiều, ${name}`,
      evening: `Chào buổi tối, ${name}`,
      late: `Dạ, ${name}`,
    },
    en: {
      morning: `Good morning, ${name}`,
      afternoon: `Good afternoon, ${name}`,
      evening: `Good evening, ${name}`,
      late: `Hi, ${name}`,
    },
  } as const;

  return map[language][part];
}
