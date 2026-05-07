"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import { VoiceInput } from "@/components/VoiceInput";
import {
  generateTaskPreview,
  submitTask,
  type TaskPreview,
} from "./actions";

type Stage = "compose" | "preview" | "submitting";

export function NewTaskFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("compose");
  const [task, setTask] = useState("");
  const [preview, setPreview] = useState<TaskPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        <h1 className="text-2xl font-medium">New task for your parent</h1>
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
            <span className="text-sm text-muted">What should your parent do?</span>
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
              The task (in Vietnamese for your parent)
            </div>
            <p className="whitespace-pre-wrap">{preview.taskVi}</p>
          </section>

          <section className="rounded-card border border-line bg-white p-5 space-y-3">
            <div className="text-sm text-muted uppercase tracking-wide">
              Steps Noi will show them
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">
              {preview.responseVi}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">
                See in English
              </summary>
              <div className="mt-3 whitespace-pre-wrap leading-relaxed border-t border-line pt-3">
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
              className="rounded-card bg-accent px-5 py-3 font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
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
