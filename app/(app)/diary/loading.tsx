/**
 * Diary loading skeleton — pulse-shimmer mirror of the timeline view.
 * Shown the moment the user taps "Family diary" in the menu.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-6 animate-pulse">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-16 rounded bg-line/60" />
          <div className="h-7 w-48 rounded bg-line/60" />
          <div className="h-4 w-64 rounded bg-line/40" />
        </div>
        <div className="h-10 w-10 rounded-full bg-line/50" />
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="h-10 w-64 rounded-card bg-line/40" />
        <div className="h-10 w-28 rounded-card bg-line/40" />
      </div>

      <section className="space-y-3">
        <div className="h-3 w-12 rounded bg-line/40" />
        <div className="h-24 rounded-card border border-line bg-white" />
        <div className="h-24 rounded-card border border-line bg-white" />
      </section>
    </main>
  );
}
