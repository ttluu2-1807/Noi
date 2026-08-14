import type { CSSProperties } from "react";

/**
 * The Noi lantern icon — the app's symbolic mark. Uses the exact SVG
 * paths from the design HTML so every rendering stays 1:1 with the
 * favicon / PWA icon.
 *
 * Four states per audit §5:
 *   · out   — empty states, failed answer                (dim greys)
 *   · dim   — thinking                                    (paler gold,
 *              caller adds animate-dim-pulse for the 2.4s ease-in-out)
 *   · glow  — listening — halo tracks input level         (caller wraps
 *              in an animated halo ring; the glass stays lit)
 *   · lit   — avatar, icon, splash, list group headers    (full colour)
 *
 * Placement rule (also audit §5): the lantern appears where Noi is
 * responsible for something on screen — NOT in the tab bar, NOT on
 * section headings, NOT on diary / to-do items. Currently used as the
 * chat avatar next to assistant messages; other placements land later
 * as we wire them.
 *
 * The body path is constant across states; only fills/strokes change,
 * per the audit's "body path is constant; cap and tassel drop below
 * 32px" spec. For simplicity we keep the cap+tassel at every size for
 * now — small enough that dropping them on the sub-32px avatar isn't
 * critical. Revisit if the lit-avatar-at-16px case ever shows up.
 */
export type LanternState = "out" | "dim" | "glow" | "lit";

interface LanternProps {
  /** Diameter in CSS pixels. Defaults to 32 (avatar-sized). */
  size?: number;
  state?: LanternState;
  /** Additional class — e.g. animation utility from Tailwind. */
  className?: string;
  /** Optional accessibility label; defaults to "Noi". */
  label?: string;
}

const PALETTE: Record<
  LanternState,
  { bg: string; handle: string; body: string; wick: string; base: string; opacity?: number }
> = {
  out: {
    bg: "#F1EDE6",
    handle: "#C9BFB2",
    body: "#F1EDE6",
    wick: "#C9BFB2",
    base: "#C9BFB2",
  },
  dim: {
    bg: "#0C7A55",
    handle: "#FBF6EE",
    body: "#FBEFD4",
    wick: "#0C7A55",
    base: "#FBF6EE",
    // dim uses opacity animation on the whole SVG per audit;
    // caller supplies the animate class. Palette matches "lit".
  },
  glow: {
    bg: "#0C7A55",
    handle: "#FBF6EE",
    body: "#F6C45A",
    wick: "#0C7A55",
    base: "#FBF6EE",
  },
  lit: {
    bg: "#0C7A55",
    handle: "#FBF6EE",
    body: "#F6C45A",
    wick: "#0C7A55",
    base: "#FBF6EE",
  },
};

export function Lantern({
  size = 32,
  state = "lit",
  className = "",
  label = "Noi",
}: LanternProps) {
  const p = PALETTE[state];
  // radius scales with size so the small avatar reads as a rounded
  // square, not a giant chip; 20/76 ~ 26% of the box.
  const radius = Math.round((20 / 76) * size);

  const style: CSSProperties = {};
  if (state === "dim") style.opacity = 0.85;

  return (
    <svg
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 76 76"
      width={size}
      height={size}
      className={className}
      style={style}
    >
      <rect width="76" height="76" rx={(20 / size) * radius * (size / 20)} fill={p.bg} />
      {/* Cap handle */}
      <path
        d="M29 22h18"
        stroke={p.handle}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Body — the constant path per audit spec */}
      <path
        d="M27 28.5c0-2 1.6-3.5 3.6-3.5h14.8c2 0 3.6 1.5 3.6 3.5v14c0 5.6-4.8 9.5-11 9.5s-11-3.9-11-9.5Z"
        fill={p.body}
      />
      {/* Wick highlight */}
      <path
        d="M35 36.5 L42.5 31.5"
        stroke={p.wick}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      {/* Base tassel */}
      <path
        d="M38 55.5v4"
        stroke={p.base}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  );
}
