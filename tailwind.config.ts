import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Noi palette — warm off-white, charcoal, soft teal accent
        bg: "#FAFAF8",
        ink: "#1C1C1A",
        accent: "#1D9E75",
        muted: "#6B6B66",
        line: "#E6E4DE",
      },
      fontFamily: {
        // DM Sans is loaded via next/font in app/layout.tsx
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        bubble: "24px",
      },
      fontSize: {
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
          "0%": { backgroundColor: "rgba(29, 158, 117, 0)" },
          "30%": { backgroundColor: "rgba(29, 158, 117, 0.2)" },
          "100%": { backgroundColor: "rgba(29, 158, 117, 0)" },
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
