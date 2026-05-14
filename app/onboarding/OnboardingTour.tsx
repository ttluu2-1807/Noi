"use client";

import { useState, useTransition } from "react";
import { HeroIllustration } from "@/components/HeroIllustration";
import { SubmitButton } from "@/components/SubmitButton";
import type { Language } from "@/lib/language-detect";
import { completeOnboarding } from "./actions";

interface OnboardingTourProps {
  language: Language;
  displayName: string;
}

const SCREENS = {
  vi: [
    {
      title: (name: string) => `Xin chào, ${name}`,
      body: "Tôi là Noi — trợ lý giúp quý vị xử lý các thủ tục hằng ngày ở Úc. Quý vị có thể hỏi tôi về Medicare, Centrelink, ngân hàng, lịch khám bệnh — bất cứ điều gì khó hiểu.",
    },
    {
      title: () => "Quý vị có thể hỏi bằng giọng nói",
      body: "Nhấn vào nút micro to lớn ở giữa màn hình rồi nói câu hỏi của quý vị. Khi nói xong, nhấn lần nữa để dừng. Hoặc gõ câu hỏi vào ô bên dưới — cả hai cách đều được.",
    },
    {
      title: () => "Gia đình của quý vị luôn ở cạnh",
      body: "Mọi câu hỏi và câu trả lời cũng hiển thị cho con của quý vị. Nếu cần thêm thông tin, con có thể giải thích hoặc gửi thêm câu hỏi giúp quý vị.",
    },
  ],
  en: [
    {
      title: (name: string) => `Welcome, ${name}`,
      body: "I'm Noi — your assistant for everyday life admin in Australia. Ask me about Medicare, Centrelink, banks, GP appointments — anything confusing.",
    },
    {
      title: () => "You can ask out loud",
      body: "Tap the big microphone in the middle to speak. Tap again to stop. Or type into the box below — both work.",
    },
    {
      title: () => "Your family is right here with you",
      body: "Every question and answer is also visible to your family member. If something's unclear, they can step in to help or send a follow-up.",
    },
  ],
} as const;

const BUTTONS = {
  vi: { next: "Tiếp theo", back: "Quay lại", start: "Bắt đầu" },
  en: { next: "Next", back: "Back", start: "Get started" },
} as const;

export function OnboardingTour({ language, displayName }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const screens = SCREENS[language];
  const buttons = BUTTONS[language];
  const isLast = step === screens.length - 1;
  const current = screens[step];

  const finish = () => {
    startTransition(async () => {
      await completeOnboarding();
    });
  };

  return (
    <div className="min-h-dvh flex flex-col px-6 py-10 max-w-md mx-auto">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-8" aria-hidden>
        {screens.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? "w-8 bg-accent" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
        <HeroIllustration className="w-48 h-24 text-accent" />
        <h1 className="text-2xl font-medium leading-tight">
          {current.title(displayName)}
        </h1>
        <p className="text-muted leading-relaxed">{current.body}</p>
      </div>

      <div className="space-y-3 pt-8">
        {!isLast ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="w-full rounded-card bg-accent px-4 py-3 font-medium text-white hover:opacity-90 transition-transform active:scale-[0.98]"
          >
            {buttons.next}
          </button>
        ) : (
          <form action={finish}>
            <SubmitButton
              className="w-full rounded-card bg-accent px-4 py-3 font-medium text-white hover:opacity-90"
              disabled={pending}
            >
              {buttons.start}
            </SubmitButton>
          </form>
        )}
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="w-full text-sm text-muted hover:text-ink"
          >
            {buttons.back}
          </button>
        )}
      </div>
    </div>
  );
}
