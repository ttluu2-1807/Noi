/**
 * Skeleton shown by Next.js loading.tsx while a thread page's server
 * fetch is in flight. Renders the same broad layout as the real page —
 * back link, title shimmer, tabs strip, a few message bubbles, composer.
 * The viewer sees structure instantly instead of a blank screen.
 *
 * Used by both /parent/thread/[id] and /child/thread/[id].
 *
 * `animate-pulse` is a Tailwind built-in that fades opacity in/out —
 * cheap and recognisable as "loading".
 */
export function ThreadPageSkeleton() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-8 space-y-6 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-20 rounded bg-line/60" />

      {/* Title row + status pill */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-5 w-3/4 rounded bg-line/60" />
          <div className="h-4 w-1/2 rounded bg-line/40" />
        </div>
        <div className="h-6 w-24 rounded-full bg-line/40" />
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-10 rounded bg-line/40" />
        <div className="h-5 w-14 rounded-full bg-line/50" />
        <div className="h-5 w-18 rounded-full bg-line/50" />
      </div>

      {/* Thread tabs */}
      <div className="h-10 rounded-card border border-line bg-line/30" />

      {/* A couple of message bubbles */}
      <section className="space-y-5">
        <div className="space-y-2 ml-6">
          <div className="h-3 w-12 rounded bg-line/40" />
          <div className="rounded-bubble bg-accent/10 p-4 space-y-2">
            <div className="h-3 w-5/6 rounded bg-line/50" />
            <div className="h-3 w-2/3 rounded bg-line/50" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-3 w-12 rounded bg-line/40" />
          <div className="rounded-bubble border border-line bg-white p-4 space-y-2">
            <div className="h-3 w-full rounded bg-line/50" />
            <div className="h-3 w-11/12 rounded bg-line/50" />
            <div className="h-3 w-4/5 rounded bg-line/50" />
            <div className="h-3 w-3/4 rounded bg-line/50" />
          </div>
        </div>
      </section>

      {/* Composer placeholder */}
      <div className="rounded-card border border-line bg-white p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-line/40" />
        <div className="h-20 rounded bg-line/30" />
        <div className="h-10 w-32 rounded-card bg-line/40 ml-auto" />
      </div>
    </main>
  );
}
