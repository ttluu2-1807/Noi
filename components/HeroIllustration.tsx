/**
 * Empty-state hero illustration. Abstract — two arcs forming a
 * connection ("Nối"), with a small soft circle between them. Reads
 * as "two people, bridged". Inline SVG so it ships with the page,
 * no asset hosting.
 *
 * Currents:
 *   - Parent home before they've asked anything
 *   - Child dashboard before any family activity
 *
 * Lightweight, no animation by default — the page motion polish
 * takes care of fade-in. Strokes use currentColor so caller picks
 * the colour via Tailwind text-*.
 */
export function HeroIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* Left arc — one half of the bridge */}
      <path d="M30 70 Q 80 20 120 60" />
      {/* Right arc — the other half */}
      <path d="M120 60 Q 160 100 210 50" />
      {/* Anchor dots */}
      <circle cx="30" cy="70" r="4" fill="currentColor" />
      <circle cx="210" cy="50" r="4" fill="currentColor" />
      {/* Centre circle — the family between them */}
      <circle cx="120" cy="60" r="6" fill="currentColor" fillOpacity="0.15" />
      <circle cx="120" cy="60" r="3" fill="currentColor" />
    </svg>
  );
}
