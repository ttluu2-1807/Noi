"use client";

import { useEffect, useState } from "react";

interface VoiceWaveformProps {
  /** Whether to animate. False = bars at idle resting height. */
  active: boolean;
  className?: string;
}

const BAR_COUNT = 5;

/**
 * Five animated bars under the mic button while recording. Reassures
 * elderly users that the mic is actually working — they often say
 * "is it listening?" and stop talking. A live waveform under the
 * button means they can SEE activity even when transcript hasn't
 * arrived yet.
 *
 * Synthetic animation (not driven by real audio) — each bar bounces
 * between min/max heights on its own irregular timer. Looks alive
 * without the complexity of opening a second mic stream alongside
 * SpeechRecognition.
 */
export function VoiceWaveform({ active, className = "" }: VoiceWaveformProps) {
  const [heights, setHeights] = useState<number[]>(() => Array(BAR_COUNT).fill(20));

  useEffect(() => {
    if (!active) {
      setHeights(Array(BAR_COUNT).fill(20));
      return;
    }
    const id = setInterval(() => {
      setHeights(
        Array.from({ length: BAR_COUNT }, () =>
          // Random height between 25–100% — irregular so the bars look natural,
          // not perfectly in sync.
          Math.floor(25 + Math.random() * 75),
        ),
      );
    }, 120);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div
      aria-hidden
      className={`flex items-center justify-center gap-1 h-6 ${className}`}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-accent transition-all duration-150 ease-out"
          style={{ height: `${(h * 24) / 100}px` }}
        />
      ))}
    </div>
  );
}
