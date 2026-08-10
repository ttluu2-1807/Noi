import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Outfit } from "next/font/google";
import { NavProgress } from "@/components/NavProgress";
import "./globals.css";

const outfit = Outfit({
  // "latin-ext" covers Vietnamese diacritics. Outfit is the v1 design
  // typeface — geometric, warm, easy to scan at both parent (18px) and
  // child (16px) base sizes.
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noi",
  description:
    "Nối — a bilingual life admin assistant for Vietnamese-speaking families in Australia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // viewportFit=cover lets us paint into the notch / home-indicator
  // regions; individual components then use pt-safe / pb-safe (see
  // globals.css) to keep content clear of them.
  viewportFit: "cover",
  themeColor: "#FBF6EE", // paper — matches body background
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={outfit.variable}>
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
