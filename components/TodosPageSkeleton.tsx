/**
 * Skeleton shown the instant a user navigates to /todos. Same fade-shimmer
 * pattern as ThreadPageSkeleton — appears under the navigation progress
 * sliver and gets replaced when the server fetch resolves.
 */
export function TodosPageSkeleton() {
  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-8 animate-pulse">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-4 w-16 rounded bg-line/60" />
          <div className="h-7 w-40 rounded bg-line/60" />
          <div className="h-4 w-56 rounded bg-line/40" />
        </div>
        <div className="h-10 w-10 rounded-full bg-line/50" />
      </header>

      {/* Composer card */}
      <section className="rounded-card border border-line bg-white p-5 space-y-4">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-line/40" />
          <div className="h-3 w-3/4 rounded bg-line/40" />
        </div>
        {/* Mic placeholder */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-28 w-28 rounded-full bg-line/40" />
          <div className="h-3 w-40 rounded bg-line/30" />
        </div>
        <div className="h-20 rounded bg-line/30" />
        <div className="flex justify-end gap-2">
          <div className="h-9 w-20 rounded-card bg-line/40" />
          <div className="h-9 w-32 rounded-card bg-line/40" />
        </div>
      </section>

      {/* Open todos */}
      <section className="space-y-2">
        <div className="h-3 w-20 rounded bg-line/40" />
        <div className="space-y-2">
          <div className="h-14 rounded-card border border-line bg-white" />
          <div className="h-14 rounded-card border border-line bg-white" />
          <div className="h-14 rounded-card border border-line bg-white" />
        </div>
      </section>
    </main>
  );
}
