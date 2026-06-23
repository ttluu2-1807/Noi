"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import { VoiceInput } from "@/components/VoiceInput";
import {
  generateTaskPreview,
  refineTaskPreview,
  submitTask,
  type TaskPreview,
} from "./actions";

const REFINE_CHIPS = [
  { label: "Simpler", prompt: "Make it simpler and easier to follow." },
  { label: "More detail", prompt: "Add more detail and concrete steps." },
  { label: "More formal", prompt: "Use a more formal, respectful tone." },
  { label: "Shorter", prompt: "Shorten this — keep only the essential steps." },
];

type Stage = "compose" | "preview" | "submitting";

export function NewTaskFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = searchParams.get("prefill");
  const [stage, setStage] = useState<Stage>("compose");
  const [task, setTask] = useState(prefill ?? "");

  // If the user arrived here via the global voice FAB, the transcript
  // is pre-loaded above. Strip the query so a back-nav doesn't refill
  // it (and so the URL stays clean for sharing).
  useEffect(() => {
    if (prefill) router.replace("/child/new-task");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [preview, setPreview] = useState<TaskPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Refinement state — what the user is asking Claude to change on top
  // of the existing preview. Cleared after a successful refine.
  const [refineInput, setRefineInput] = useState("");

  const onPreview = () => {
    const trimmed = task.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await generateTaskPreview(trimmed);
      if (result.ok) {
        setPreview(result.preview);
        setStage("preview");
      } else {
        setError(result.error);
      }
    });
  };

  const onSubmit = () => {
    if (!preview) return;
    setStage("submitting");
    startTransition(async () => {
      const result = await submitTask(preview);
      if (result.ok) {
        router.push(`/child/thread/${result.threadId}`);
      } else {
        setError(result.error);
        setStage("preview");
      }
    });
  };

  const onRefine = (instruction: string) => {
    if (!preview) return;
    const trimmed = instruction.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await refineTaskPreview(preview, trimmed);
      if (result.ok) {
        setPreview(result.preview);
        setRefineInput("");
      } else {
        setError(result.error);
      }
    });
  };

  /**
   * Inline-edit helpers. We let the child tweak the Vietnamese task
   * line and the Vietnamese response directly — sometimes a one-word
   * adjustment is faster than asking Claude to rewrite.
   *
   * Editing the Vietnamese side invalidates the cached English
   * translation; we leave the English as-is and trust that it'll be
   * close enough for review purposes — the parent only sees the
   * Vietnamese anyway. If the child wants a fresh English translation
   * after manual edits, they can re-refine.
   */
  const onEditField = (field: "taskVi" | "responseVi", value: string) => {
    if (!preview) return;
    setPreview({ ...preview, [field]: value });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
      <header>
        <Link
          href="/child"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-3"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-2xl font-medium">New task for a parent</h1>
        <p className="text-muted text-sm mt-1">
          Write in English — we&apos;ll translate and generate step-by-step
          instructions in Vietnamese.
        </p>
      </header>

      {stage === "compose" && (
        <div className="space-y-4">
          <div className="rounded-card border border-line bg-white p-5">
            <VoiceInput
              language="en"
              onTranscript={(t) => setTask(t)}
              placeholder="Listening — describe the task in English."
            />
          </div>
          <label className="block space-y-2">
            <span className="text-sm text-muted">What should they do?</span>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={5}
              placeholder="e.g. Renew your Medicare card. It expired last month and you need a new one before your GP visit."
              className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none resize-none"
              disabled={pending}
            />
          </label>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPreview}
              disabled={pending || !task.trim()}
              className="rounded-card bg-accent px-4 py-3 font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {pending ? "Generating…" : "Preview translation"}
            </button>
            {pending && <LoadingDots />}
          </div>
        </div>
      )}

      {stage === "preview" && preview && (
        <div className="space-y-5">
          <section className="rounded-card border border-line bg-white p-5 space-y-3">
            <div className="text-sm text-muted uppercase tracking-wide">
              The task (in Vietnamese — edit if needed)
            </div>
            <textarea
              value={preview.taskVi}
              onChange={(e) => onEditField("taskVi", e.target.value)}
              rows={2}
              disabled={pending}
              className="w-full rounded-card border border-line/60 bg-white px-3 py-2 leading-relaxed focus:border-accent focus:outline-none resize-none"
            />
          </section>

          <section className="rounded-card border border-line bg-white p-5 space-y-3">
            <div className="text-sm text-muted uppercase tracking-wide">
              Steps Noi will show them — edit if needed
            </div>
            <textarea
              value={preview.responseVi}
              onChange={(e) => onEditField("responseVi", e.target.value)}
              rows={Math.min(14, Math.max(6, preview.responseVi.split("\n").length + 1))}
              disabled={pending}
              className="w-full rounded-card border border-line/60 bg-white px-3 py-2 leading-relaxed focus:border-accent focus:outline-none resize-none"
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">
                See in English
              </summary>
              <div className="mt-3 whitespace-pre-wrap leading-relaxed border-t border-line pt-3 text-muted">
                {preview.responseEn}
              </div>
            </details>
          </section>

          {preview.checklist.length > 0 && (
            <section className="rounded-card border border-line bg-white p-5 space-y-2">
              <div className="text-sm text-muted uppercase tracking-wide">
                Checklist
              </div>
              <ul className="space-y-1 text-sm">
                {preview.checklist.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted">☐</span>
                    <span>{item.text_en}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Refinement panel — chips for common asks + free-form input.
              Calls refineTaskPreview which re-runs Claude with the
              current preview as context plus the refinement instruction. */}
          <section className="rounded-card border border-dashed border-line bg-bg/50 p-5 space-y-3">
            <div className="text-sm text-muted uppercase tracking-wide">
              Refine with Noi
            </div>
            <div className="flex flex-wrap gap-2">
              {REFINE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onRefine(chip.prompt)}
                  disabled={pending}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs text-ink hover:border-accent/40 disabled:opacity-40 transition-transform active:scale-95"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                placeholder="Or type your own ask, e.g. 'add a step about bringing ID'"
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && refineInput.trim()) {
                    e.preventDefault();
                    onRefine(refineInput);
                  }
                }}
                className="flex-1 rounded-card border border-line bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onRefine(refineInput)}
                disabled={pending || !refineInput.trim()}
                className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition-transform active:scale-[0.98]"
              >
                Refine
              </button>
            </div>
            {pending && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <LoadingDots />
                Refining…
              </div>
            )}
          </section>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStage("compose")}
              className="text-sm text-muted hover:text-ink underline-offset-4 hover:underline"
              disabled={pending}
            >
              ← Edit task
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="rounded-card bg-accent px-5 py-3 font-medium text-white disabled:opacity-40 hover:opacity-90 transition-transform active:scale-[0.98]"
            >
              {pending ? "Sending…" : "Send to parent"}
            </button>
          </div>
        </div>
      )}

      {stage === "submitting" && (
        <div className="rounded-card border border-line bg-white p-8 text-center space-y-3">
          <LoadingDots />
          <p className="text-muted">Creating the thread…</p>
        </div>
      )}
    </main>
  );
}
