import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { DM_Sans } from "next/font/google";
import { NavProgress } from "@/components/NavProgress";
import "./globals.css";

const dmSans = DM_Sans({
  // "latin-ext" covers Vietnamese diacritics; DM Sans does not expose a
  // separate "vietnamese" subset via next/font.
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noi",
  description: "Nối — a bilingual life admin assistant for Vietnamese-speaking families in Australia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FAFAF8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={dmSans.variable}>
      <body>
        {/* useSearchParams inside NavProgress needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
