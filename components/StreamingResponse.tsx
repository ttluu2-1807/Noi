"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingDots } from "./LoadingDots";
import { renderTextWithLinks } from "@/lib/render-text";
import type { Language } from "@/lib/language-detect";

interface StreamingResponseProps {
  /** The user's question. Triggers the chat request once, on mount. */
  query: string;
  /** Existing thread id, or null to create a new one. */
  threadId: string | null;
  language: Language;
  /**
   * "query" (default) = normal question.
   * "copilot_comment" = child adding context to an existing thread.
   */
  messageType?: "query" | "copilot_comment";
  /** Called once the stream completes, with the resolved thread id. */
  onComplete: (threadId: string) => void;
  /** Called if the stream errors out. */
  onError?: (err: Error) => void;
}

const ERROR_TEXT: Record<Language, string> = {
  vi: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.",
  en: "Something went wrong. Please try again.",
};

/**
 * Kicks off a POST to /api/chat and renders the streamed response
 * character-by-character. Calls onComplete with the thread id (from
 * response headers) once the server has finished translating, saving
 * the assistant message, and extracting the checklist.
 */
export function StreamingResponse({
  query,
  threadId,
  language,
  messageType = "query",
  onComplete,
  onError,
}: StreamingResponseProps) {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);
  const [failed, setFailed] = useState(false);
  // Keep the latest callbacks in refs so the effect doesn't re-run
  // when parent re-renders pass new function identities.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  useEffect(() => {
    // React 18 StrictMode runs this effect twice in dev. The previous
    // version of this component tried to block the second run with a
    // ref guard — but the first run is aborted by cleanup, so the
    // guard ended up cancelling EVERY fetch. Correct pattern: let both
    // effects fire, abort the first on cleanup, let the second
    // complete. AbortError is ignored in the catch.
    const controller = new AbortController();
    let aborted = false;

    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            message: query,
            language,
            messageType,
          }),
          signal: controller.signal,
        });

        if (aborted) return;
        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const resolvedThreadId =
          res.headers.get("X-Thread-Id") ?? threadId ?? "";

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (aborted) return;
          if (value) {
            setText((prev) => prev + decoder.decode(value, { stream: true }));
          }
        }

        if (aborted) return;
        setIsStreaming(false);
        if (resolvedThreadId) onCompleteRef.current(resolvedThreadId);
      } catch (err) {
        if (aborted || (err as { name?: string }).name === "AbortError") return;
        console.error("[StreamingResponse]", err);
        setFailed(true);
        setIsStreaming(false);
        onErrorRef.current?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
    // Intentionally depend only on identity of the request inputs —
    // parent re-renders with stable query/threadId won't re-kick.
  }, [query, threadId, language, messageType]);

  if (failed && !text) {
    return <p className="text-red-600">{ERROR_TEXT[language]}</p>;
  }

  return (
    <div className="space-y-3">
      {text ? (
        <div className="whitespace-pre-wrap leading-relaxed">
          {renderTextWithLinks(text)}
        </div>
      ) : (
        <LoadingDots />
      )}
      {isStreaming && text && <LoadingDots />}
    </div>
  );
}
