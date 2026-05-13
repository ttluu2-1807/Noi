"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VoiceInput } from "@/components/VoiceInput";
import { StreamingResponse } from "@/components/StreamingResponse";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import type { Attachment } from "@/lib/storage";
import { replyToThread } from "./actions";

type Destination = "parent" | "noi";

interface ChildComposerProps {
  threadId: string;
  familySpaceId: string;
}

/**
 * Unified composer for the child's thread view.
 *
 * One textarea, one voice mic, one Send button. A destination toggle
 * decides what happens on send:
 *
 *   - "parent" (default) → translate to Vietnamese and post as a message
 *     visible to the parent. Direct family chat.
 *   - "noi"             → ask Noi to clarify or improve the answer using
 *     this as additional context (messageType="copilot_comment"). Streams
 *     a fresh AI reply inline.
 *
 * Replaces the previous separate `ReplyForm` and `AddContextPanel` so
 * the child has one place to type and chooses the audience explicitly.
 */
export function ChildComposer({ threadId, familySpaceId }: ChildComposerProps) {
  const router = useRouter();
  const [destination, setDestination] = useState<Destination>("parent");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingReply, startReplyTransition] = useTransition();
  const [askingNoi, setAskingNoi] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);

  // While Noi is streaming a response we hide the composer and show the
  // pending question + StreamingResponse. Once it's done, the realtime
  // boundary in the parent page picks up the new rows from the DB.
  if (askingNoi) {
    return (
      <section className="rounded-card border border-line bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted uppercase tracking-wide">
          <span className="rounded-full bg-accent/10 text-accent px-2 py-0.5">Ask Noi</span>
          Updating with your context…
        </div>
        <div className="rounded-bubble bg-accent/10 p-3 text-sm">{askingNoi}</div>
        <StreamingResponse
          query={askingNoi}
          threadId={threadId}
          language="en"
          messageType="copilot_comment"
          attachments={pendingAttachment ? [pendingAttachment] : undefined}
          onComplete={() => {
            setAskingNoi(null);
            setText("");
            setPendingAttachment(null);
            router.refresh();
          }}
        />
      </section>
    );
  }

  const sendToParent = (trimmed: string, att: Attachment | null) => {
    setError(null);
    startReplyTransition(async () => {
      const fd = new FormData();
      fd.set("threadId", threadId);
      fd.set("message", trimmed);
      fd.set("attachments", JSON.stringify(att ? [att] : []));
      const result = await replyToThread(fd);
      if (result.ok) {
        setText("");
        setAttachment(null);
      } else {
        setError(result.error);
      }
    });
  };

  const onSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    if (destination === "parent") {
      sendToParent(trimmed, attachment);
    } else {
      setPendingAttachment(attachment);
      setAskingNoi(
        trimmed ||
          "Could you explain what's in this image and how it relates to the thread?",
      );
      setAttachment(null);
    }
  };

  const placeholderForDestination =
    destination === "parent"
      ? "Write to your parent in English — we'll translate to Vietnamese."
      : "Ask Noi to clarify, or add context to improve the answer.";

  return (
    <section className="rounded-card border border-line bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Send to:</span>
        <div className="inline-flex rounded-full border border-line bg-bg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setDestination("parent")}
            className={`rounded-full px-3 py-1 transition-colors ${
              destination === "parent"
                ? "bg-accent text-white"
                : "text-muted hover:text-ink"
            }`}
          >
            Parent
          </button>
          <button
            type="button"
            onClick={() => setDestination("noi")}
            className={`rounded-full px-3 py-1 transition-colors ${
              destination === "noi"
                ? "bg-accent text-white"
                : "text-muted hover:text-ink"
            }`}
          >
            Ask Noi
          </button>
        </div>
      </div>

      <VoiceInput
        language="en"
        onTranscript={(t) => setText(t)}
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={placeholderForDestination}
        className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none resize-none"
        disabled={pendingReply}
      />

      <AttachmentPicker
        familySpaceId={familySpaceId}
        language="en"
        attachment={attachment}
        onChange={setAttachment}
        disabled={pendingReply}
      />

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSend}
          disabled={pendingReply || (!text.trim() && !attachment)}
          className="rounded-card bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {pendingReply
            ? "Translating…"
            : destination === "parent"
              ? "Send to parent"
              : "Ask Noi"}
        </button>
      </div>
    </section>
  );
}
