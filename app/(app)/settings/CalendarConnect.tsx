"use client";

import { useState, useTransition } from "react";
import { disconnectGoogleCalendar } from "./calendar-actions";
import type { Language } from "@/lib/language-detect";

interface CalendarConnectProps {
  language: Language;
  connection: {
    connected_email: string | null;
    connected_name: string | null;
  } | null;
  /** ?calendarError=... or ?calendarConnected=1 from the OAuth callback. */
  errorFromQuery: string | null;
  connectedFlash: boolean;
}

const T = {
  vi: {
    heading: "Lịch Google",
    subtitleConnected: (email: string | null) =>
      email
        ? `Đã kết nối với ${email}.`
        : "Đã kết nối. Noi có thể xem lịch của quý vị.",
    subtitleNot:
      "Kết nối lịch để Noi giúp tìm thời gian rảnh của gia đình.",
    connect: "Kết nối Google Calendar",
    connectAgain: "Kết nối tài khoản khác",
    disconnect: "Ngắt kết nối",
    disconnecting: "Đang ngắt...",
    connectedFlash: "Kết nối thành công.",
    connecting: "Đang chuyển tới Google...",
  },
  en: {
    heading: "Google Calendar",
    subtitleConnected: (email: string | null) =>
      email ? `Connected as ${email}.` : "Connected. Noi can see your calendar.",
    subtitleNot:
      "Connect a calendar so Noi can help find times when the family is free.",
    connect: "Connect Google Calendar",
    connectAgain: "Connect a different account",
    disconnect: "Disconnect",
    disconnecting: "Disconnecting…",
    connectedFlash: "Connected successfully.",
    connecting: "Redirecting to Google…",
  },
} as const;

/**
 * Per-user Google Calendar connect / disconnect surface on /settings.
 * Each family member connects their own account — no delegation. If
 * the parent needs help, the child sits with them and taps through
 * the OAuth flow together.
 *
 * State is server-fed via the `connection` prop (loaded in the page's
 * server component). Success / error surfaces via ?calendarError= /
 * ?calendarConnected= query params written by the callback route.
 */
export function CalendarConnect({
  language,
  connection,
  errorFromQuery,
  connectedFlash,
}: CalendarConnectProps) {
  const t = T[language];
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const isConnected = !!connection;

  const connect = () => {
    setRedirecting(true);
    // Full-page nav to the API route which redirects to Google.
    // A fetch would swallow the redirect chain — need the browser to
    // follow it end-to-end.
    window.location.href = "/api/calendar/google/connect";
  };

  const disconnect = () => {
    startTransition(async () => {
      await disconnectGoogleCalendar();
    });
  };

  return (
    <section className="rounded-card border border-line bg-surface p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="shrink-0 mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-wash text-green-text"
        >
          <CalIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-medium text-ink">{t.heading}</h2>
          <p className="text-body-sm text-ink-3 mt-0.5">
            {isConnected ? t.subtitleConnected(connection.connected_email) : t.subtitleNot}
          </p>
        </div>
      </div>

      {connectedFlash && (
        <p className="text-body-sm text-green-text" role="status">
          {t.connectedFlash}
        </p>
      )}
      {errorFromQuery && (
        <p className="text-body-sm text-danger" role="alert">
          {errorFromQuery}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!isConnected && (
          <button
            type="button"
            onClick={connect}
            disabled={redirecting}
            className="btn-primary rounded-card px-4 py-2 text-body-sm"
          >
            {redirecting ? t.connecting : t.connect}
          </button>
        )}
        {isConnected && (
          <>
            <button
              type="button"
              onClick={connect}
              disabled={redirecting || pending}
              className="rounded-card border border-line bg-surface px-3 py-1.5 text-body-sm text-ink hover:border-green/40 transition-colors"
            >
              {redirecting ? t.connecting : t.connectAgain}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={pending || redirecting}
              className="rounded-card border border-line bg-surface px-3 py-1.5 text-body-sm text-ink-3 hover:text-ink hover:border-line"
            >
              {pending ? t.disconnecting : t.disconnect}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}
