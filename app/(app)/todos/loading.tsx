import { TodosPageSkeleton } from "@/components/TodosPageSkeleton";

/**
 * Next.js shows this the moment the user navigates to /todos, before
 * the server fetch resolves. Same pattern as the thread pages.
 */
export default function Loading() {
  return <TodosPageSkeleton />;
}
