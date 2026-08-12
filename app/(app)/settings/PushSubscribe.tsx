"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  savePushSubscription,
  deletePushSubscription,
  sendTestPush,
} from "./push-actions";
import type { Language } from "@/lib/language-detect";

interface PushSubscribeProps {
  language: Language;
  /** Public VAPID key — safe to expose; used to subscribe the browser. */
  vapidPublicKey: string | null;
  /** Whether the server already has a subscription for this user. */
  initiallySubscribed: boolean;
}

type Support =
  | { state: "loading" }
  | { state: "unsupported"; reason: string }
  | { state: "denied" }
  | { state: "ready" }
  | { state: "subscribed" };

const T = {
  vi: {
    heading: "Nhắc nhở qua điện thoại",
    subtitle:
      "Bật để nhận nhắc nhở về việc quá hạn, câu hỏi mới, và tóm tắt hàng ngày.",
    enable: "Bật nhắc nhở",
    disable: "Tắt nhắc nhở",
    enabling: "Đang bật...",
    disabling: "Đang tắt...",
    subscribed: "Đã bật. Điện thoại này sẽ nhận nhắc nhở từ Noi.",
    denied:
      "Quý vị đã tắt quyền thông báo cho Noi. Vào Cài đặt điện thoại → Safari (hoặc Chrome) → Noi → Thông báo để bật lại.",
    unsupported:
      "Trình duyệt này không hỗ trợ thông báo. Trên iPhone: mở Noi trong Safari, nhấn nút Chia sẻ, rồi chọn 'Thêm vào Màn hình chính'. Sau đó mở Noi từ biểu tượng trên màn hình chính và thử lại.",
    unsupportedNoInstall:
      "Trên iPhone, để nhận thông báo phải thêm Noi vào Màn hình chính trước. Nhấn nút Chia sẻ trong Safari → Thêm vào Màn hình chính, rồi mở Noi từ biểu tượng đó.",
    notConfigured:
      "Chức năng thông báo chưa được cài đặt. Vui lòng liên hệ quản trị viên.",
    test: "Gửi thử một thông báo",
    testing: "Đang gửi...",
    testSent: (n: number) =>
      `Đã gửi tới ${n} thiết bị. Kiểm tra thông báo.`,
    testGone: "Đăng ký cũ đã bị xoá. Xin bật lại.",
    testFailed: "Không gửi được. Vui lòng thử lại.",
  },
  en: {
    heading: "Push notifications",
    subtitle:
      "Get nudges for overdue tasks, new questions, and the daily digest.",
    enable: "Turn on notifications",
    disable: "Turn off notifications",
    enabling: "Turning on…",
    disabling: "Turning off…",
    subscribed: "On. This device will receive Noi nudges.",
    denied:
      "You've blocked notifications for Noi. Go to your device Settings → Safari (or Chrome) → Noi → Notifications to re-enable.",
    unsupported:
      "This browser doesn't support notifications. On iPhone: open Noi in Safari, tap the Share button, then 'Add to Home Screen'. Open Noi from that home-screen icon and try again.",
    unsupportedNoInstall:
      "On iPhone, notifications need Noi installed to the Home Screen. Tap the Share button in Safari → Add to Home Screen, then open Noi from the icon.",
    notConfigured:
      "Notifications aren't set up on the server yet. Ask your admin to configure VAPID keys.",
    test: "Send a test notification",
    testing: "Sending…",
    testSent: (n: number) =>
      `Sent to ${n} device${n === 1 ? "" : "s"}. Check for the notification.`,
    testGone: "Old subscription was cleaned up. Turn on again.",
    testFailed: "Couldn't send. Please try again.",
  },
} as const;

/**
 * Push notification subscribe / unsubscribe surface for /settings.
 *
 * Handles four states the user can be in:
 *   · loading     — feature-detecting
 *   · unsupported — browser or context can't do Web Push (iOS Safari
 *                   tab, ancient browsers, etc.)
 *   · denied      — user previously said no; only they can re-allow
 *                   via OS settings
 *   · ready       — supported + no subscription yet → show subscribe
 *   · subscribed  — active subscription for this device → show disable
 *
 * iOS caveat: Web Push requires the site installed to Home Screen.
 * A regular Safari tab has serviceWorker but no PushManager and will
 * fall into "unsupported" with the install instructions.
 */
export function PushSubscribe({
  language,
  vapidPublicKey,
  initiallySubscribed,
}: PushSubscribeProps) {
  const t = T[language];
  const [support, setSupport] = useState<Support>({ state: "loading" });
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { ok: true; message: string }
    | { ok: false; message: string }
    | null
  >(null);

  // Feature-detect on mount. iOS Safari without home-screen install
  // has serviceWorker but is missing PushManager on Notification —
  // detect that specifically to give the right guidance.
  useEffect(() => {
    if (typeof window === "undefined") {
      setSupport({ state: "unsupported", reason: "ssr" });
      return;
    }
    if (!vapidPublicKey) {
      setSupport({ state: "unsupported", reason: "no-vapid" });
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setSupport({ state: "unsupported", reason: "no-sw" });
      return;
    }
    if (!("PushManager" in window)) {
      setSupport({ state: "unsupported", reason: "no-push" });
      return;
    }
    if (!("Notification" in window)) {
      setSupport({ state: "unsupported", reason: "no-notif" });
      return;
    }

    if (Notification.permission === "denied") {
      setSupport({ state: "denied" });
      return;
    }

    setSupport({ state: initiallySubscribed ? "subscribed" : "ready" });
  }, [vapidPublicKey, initiallySubscribed]);

  const enable = useCallback(() => {
    if (!vapidPublicKey) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const reg = await ensureServiceWorker();
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setSupport({ state: "denied" });
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const serialised = sub.toJSON();
        const p256dh = serialised.keys?.p256dh;
        const auth = serialised.keys?.auth;
        if (!serialised.endpoint || !p256dh || !auth) {
          throw new Error("Subscription missing keys");
        }
        const result = await savePushSubscription({
          endpoint: serialised.endpoint,
          p256dh,
          auth,
          userAgent: navigator.userAgent,
        });
        if (!result.ok) throw new Error(result.error);
        setSupport({ state: "subscribed" });
      } catch (err) {
        console.error("[PushSubscribe] enable failed:", err);
        setFeedback({
          ok: false,
          message:
            err instanceof Error ? err.message : t.testFailed,
        });
      }
    });
  }, [vapidPublicKey, t]);

  const disable = useCallback(() => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await deletePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setSupport({ state: "ready" });
      } catch (err) {
        console.error("[PushSubscribe] disable failed:", err);
      }
    });
  }, []);

  const test = useCallback(() => {
    setFeedback(null);
    startTransition(async () => {
      const result = await sendTestPush();
      if (!result.ok) {
        setFeedback({ ok: false, message: result.error || t.testFailed });
      } else if (result.gone > 0 && result.sent === 0) {
        setFeedback({ ok: false, message: t.testGone });
        setSupport({ state: "ready" });
      } else {
        setFeedback({ ok: true, message: t.testSent(result.sent) });
      }
    });
  }, [t]);

  return (
    <section className="rounded-card border border-line bg-surface p-5 space-y-3">
      <div className="space-y-1">
        <h2 className="text-body font-medium text-ink">{t.heading}</h2>
        <p className="text-body-sm text-ink-3">{t.subtitle}</p>
      </div>

      {support.state === "loading" && (
        <p className="text-body-sm text-ink-3">…</p>
      )}

      {support.state === "unsupported" && (
        <p className="text-body-sm text-ink-3">
          {support.reason === "no-vapid" ? t.notConfigured : t.unsupported}
        </p>
      )}

      {support.state === "denied" && (
        <p className="text-body-sm text-danger">{t.denied}</p>
      )}

      {support.state === "ready" && (
        <button
          type="button"
          onClick={enable}
          disabled={pending}
          className="btn-primary rounded-card px-4 py-2.5 text-body-sm"
        >
          {pending ? t.enabling : t.enable}
        </button>
      )}

      {support.state === "subscribed" && (
        <div className="space-y-2">
          <p className="text-body-sm text-green-text">{t.subscribed}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={test}
              disabled={pending}
              className="rounded-card border border-line bg-surface px-3 py-1.5 text-body-sm text-ink hover:border-green/40 transition-colors"
            >
              {pending ? t.testing : t.test}
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={pending}
              className="rounded-card border border-line bg-surface px-3 py-1.5 text-body-sm text-ink-3 hover:text-ink hover:border-line transition-colors"
            >
              {pending ? t.disabling : t.disable}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <p
          className={`text-body-sm ${feedback.ok ? "text-green-text" : "text-danger"}`}
          role={feedback.ok ? "status" : "alert"}
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  // If the SW isn't registered yet, register it now.
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/**
 * Convert the base64url-encoded VAPID public key into the ArrayBuffer
 * shape pushManager.subscribe expects. TS is strict about
 * SharedArrayBuffer vs ArrayBuffer here, so we build a fresh
 * ArrayBuffer explicitly rather than relying on Uint8Array's default
 * backing store.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
