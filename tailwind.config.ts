import type { Config } from "tailwindcss";

/**
 * Noi design tokens — v1 handoff.
 *
 * The colour rule: green means Noi is responsible for something, clay
 * means a person is. Never mix them on one element; the palette has two
 * accents specifically to keep this distinction legible.
 *
 * Old token names (accent, muted, bg) are aliased to their v1 equivalents
 * so existing components pick up the new palette automatically.
 */

const colors = {
  // Noi is responsible — buttons, mic, assistant messages, source-truth marks
  green: "#0C7A55",
  "green-text": "#0A6A4A",
  "green-wash": "#E3EFE8",

  // A person is responsible — family messages, human authorship, warm actions
  clay: "#C4622D",
  "clay-deep": "#A54B1B",
  "clay-wash": "#F8EADF",

  lantern: "#F6C45A",

  // Surfaces
  paper: "#FBF6EE",
  surface: "#FFFFFF",
  line: "#EBE2D5",

  // Text
  ink: "#241E1A",
  "ink-2": "#4A423B",
  "ink-3": "#6B6058",

  // Status
  "warn-wash": "#FDF6E9",
  danger: "#9E441F",

  // ---- Aliases for the pre-v1 token names ---------------------------
  // Keep existing components rendering without a mass rename. New code
  // should prefer the semantic names above.
  bg: "#FBF6EE", // → paper
  accent: "#0C7A55", // → green
  muted: "#6B6058", // → ink-3
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors,
      fontFamily: {
        // Outfit is loaded via next/font in app/layout.tsx and exposed
        // through --font-outfit. Includes latin-ext for Vietnamese
        // diacritics.
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // v1 geometry
        card: "16px",
        control: "12px",
        "sheet-top": "26px",
        // Legacy name kept for existing message-bubble usage.
        bubble: "24px",
      },
      spacing: {
        // Layout gutter used by top-level page containers.
        gutter: "22px",
        // Minimum tap target — every interactive element ≥ this.
        "tap-min": "44px",
        // Mic sizes: FAB (floating on non-home) and hero (parent home).
        "mic-fab": "64px",
        "mic-hero": "164px",
        // iOS safe-area helpers so components can call e.g. pt-safe.
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      fontSize: {
        // v1 type scale — matches the design tokens table exactly.
        // Format: [size, { lineHeight, letterSpacing?, fontWeight? }].
        // Weights are hints; use font-medium etc. where the design calls
        // for it — Tailwind's fontSize plugin doesn't apply the weight.
        display: ["26px", { lineHeight: "1.15" }],
        title: ["19px", { lineHeight: "1.25" }],
        lead: ["17.5px", { lineHeight: "1.4" }],
        body: ["16.5px", { lineHeight: "1.45" }],
        "body-sm": ["15px", { lineHeight: "1.5" }],
        label: ["15px", { letterSpacing: "0.06em", lineHeight: "1.3" }],
        nav: ["13px", { lineHeight: "1.3" }],
        // Parent view uses 18px base, child view 16px — handled by root class
        "parent-base": ["18px", { lineHeight: "1.55" }],
        "child-base": ["16px", { lineHeight: "1.5" }],
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        dotPulse: {
          "0%, 80%, 100%": { opacity: "0.3" },
          "40%": { opacity: "1" },
        },
        navProgress: {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(50%)" },
        },
        // Atmosphere: lists fade-and-rise on mount, message bubbles
        // spring in when they're newly added, tags pop in, and the
        // checklist tick flashes green before fading to the resolved
        // line-through state.
        fadeRise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        springIn: {
          "0%": { opacity: "0", transform: "scale(0.95) translateY(6px)" },
          "70%": { opacity: "1", transform: "scale(1.02) translateY(0)" },
          "100%": { transform: "scale(1) translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "70%": { opacity: "1", transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        tickFlash: {
          // Uses the new green (#0C7A55 = 12,122,85) — was old teal.
          "0%": { backgroundColor: "rgba(12, 122, 85, 0)" },
          "30%": { backgroundColor: "rgba(12, 122, 85, 0.2)" },
          "100%": { backgroundColor: "rgba(12, 122, 85, 0)" },
        },
      },
      animation: {
        "pulse-ring": "pulseRing 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "dot-pulse": "dotPulse 1.4s ease-in-out infinite",
        "nav-progress": "navProgress 1.2s ease-out forwards",
        "fade-rise": "fadeRise 0.35s ease-out both",
        "spring-in": "springIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "pop-in": "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "tick-flash": "tickFlash 0.8s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
