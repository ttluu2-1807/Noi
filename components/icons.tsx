/**
 * Curated icon set for Noi. Single visual language across the app —
 * line-stroke style, 24×24 viewBox, currentColor stroke so callers
 * pick the colour via Tailwind `text-*`. Inline SVG so no extra
 * bundle weight or runtime cost beyond what's already on the page.
 *
 * Pattern of replacement:
 *   - Emoji in body text (✓, 📅, 🤔, 📝, 📎): keep — they read as
 *     content/typography, not as iconography.
 *   - Emoji used as iconography (📅 for "diary entry", 📝 for "todo"):
 *     swap to the line-stroke icons below for consistency with the
 *     existing button SVGs (HeaderMenu's avatar, ThreadCard's
 *     attachment, etc.).
 *
 * Each component takes a `className` so callers can size + colour.
 */

interface IconProps {
  className?: string;
}

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h4v-6h6v6h4V10" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 7a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H9l-4 4v-4H6a3 3 0 01-3-3V7z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

export function TodoIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 12l2 2 4-4" />
      <path d="M14 5v0" />
    </svg>
  );
}

export function DiaryIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M14 4l6 6L10 20l-6 1 1-6z" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function ThinkingIcon({ className }: IconProps) {
  // Used for "decision" diary entries — a lightbulb-ish silhouette.
  return (
    <svg {...baseProps} className={className}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.6 1 1.4 1 2.2V17h6v-1.3c0-.8.4-1.6 1-2.2A6 6 0 0012 3z" />
    </svg>
  );
}
