import { ThreadPageSkeleton } from "@/components/ThreadPageSkeleton";

/**
 * Shown by Next.js the moment the user navigates into a parent thread,
 * before the server fetch resolves. Same skeleton as the child side —
 * the actual page renders different language strings, but the layout
 * is identical at the structural level.
 */
export default function Loading() {
  return <ThreadPageSkeleton />;
}
