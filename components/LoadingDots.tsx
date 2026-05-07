/**
 * Three soft pulsing dots — our "AI is thinking" indicator.
 * Deliberately low-energy: no spinner, no progress bar.
 */
export function LoadingDots({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} aria-label="Loading" role="status">
      <span className="h-2 w-2 rounded-full bg-muted animate-dot-pulse [animation-delay:-0.32s]" />
      <span className="h-2 w-2 rounded-full bg-muted animate-dot-pulse [animation-delay:-0.16s]" />
      <span className="h-2 w-2 rounded-full bg-muted animate-dot-pulse" />
    </div>
  );
}
