"use client";

import { useEffect, useRef, useState } from "react";

interface CodeInputProps {
  /** Hidden field name that submits the joined code to the server action. */
  name: string;
  length?: number;
}

/**
 * Six-box OTP code input. Per audit screen 17:
 *
 *   - One tap fills one digit, focus advances automatically
 *   - Backspace on an empty box moves focus back
 *   - Paste on any box fills all six
 *   - inputMode=numeric so mobile shows the number pad, not the keyboard
 *   - autoComplete=one-time-code so iOS surfaces the code from the SMS/
 *     email that just arrived as a QuickType chip above the keyboard
 *
 * The joined value is mirrored to a hidden input so the enclosing
 * <form action={serverAction}> submits it as one field.
 */
export function CodeInput({ name, length = 6 }: CodeInputProps) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, () => ""),
  );
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Focus the first box on mount so a returning user can start typing
  // (or the code from a paste) immediately.
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setAt = (i: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const onChange = (i: number, raw: string) => {
    // A single character typed → fill this box, advance focus.
    // Multiple characters (autofill / paste into one box) → spread across.
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length <= 1) {
      setAt(i, cleaned);
      if (cleaned && i < length - 1) {
        refs.current[i + 1]?.focus();
      }
      return;
    }
    // Multi-character insert: spread over the remaining boxes.
    spread(cleaned, i);
  };

  const onPaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    spread(text, i);
  };

  const spread = (text: string, startAt: number) => {
    setDigits((prev) => {
      const next = [...prev];
      for (let k = 0; k < text.length && startAt + k < length; k++) {
        next[startAt + k] = text[k];
      }
      return next;
    });
    // Focus the last filled box (or the last box if full).
    const lastIdx = Math.min(startAt + text.length - 1, length - 1);
    // Timeout so state has flushed before the focus call.
    setTimeout(() => {
      refs.current[lastIdx]?.focus();
      refs.current[lastIdx]?.select();
    }, 0);
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      // Empty box + backspace = jump back and clear the previous box too.
      e.preventDefault();
      setAt(i - 1, "");
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const joined = digits.join("");

  return (
    <div className="flex justify-center">
      {/* Hidden aggregated value — this is what the server action reads. */}
      <input type="hidden" name={name} value={joined} />
      <div
        className="inline-flex gap-2"
        role="group"
        aria-label={`${length}-digit code`}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Digit ${i + 1}`}
            className="h-14 w-11 rounded-control border border-line bg-surface text-center text-title font-medium text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/20 transition-colors"
          />
        ))}
      </div>
    </div>
  );
}
