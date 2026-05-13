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
      },
      animation: {
        "pulse-ring": "pulseRing 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "dot-pulse": "dotPulse 1.4s ease-in-out infinite",
        "nav-progress": "navProgress 1.2s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
