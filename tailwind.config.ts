import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#07080d",
          secondary: "#0e1016",
          tertiary: "#15181f",
          card: "#0b0d13",
        },
        accent: {
          blue: "#4f8cff",
          green: "#34d399",
          red: "#f87171",
          yellow: "#fbbf24",
          purple: "#a78bfa",
          orange: "#fb923c",
        },
        neon: {
          green:  "#3dffb0",
          cyan:   "#44e7ff",
          purple: "#c77dff",
          orange: "#ff9f45",
          red:    "#ff4d6d",
          yellow: "#ffe94a",
          pink:   "#ff5db1",
          blue:   "#5b8cff",
        },
        muted: "#7b8396",
        border: "#1a1d28",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        card:        "0 2px 4px rgba(0, 0, 0, 0.35)",
        "glow-green":  "0 0 0 1px rgba(61, 255, 176, 0.35), 0 0 28px -6px rgba(61, 255, 176, 0.55)",
        "glow-cyan":   "0 0 0 1px rgba(68, 231, 255, 0.35), 0 0 28px -6px rgba(68, 231, 255, 0.55)",
        "glow-purple": "0 0 0 1px rgba(199, 125, 255, 0.35), 0 0 28px -6px rgba(199, 125, 255, 0.55)",
        "glow-orange": "0 0 0 1px rgba(255, 159, 69,  0.35), 0 0 28px -6px rgba(255, 159, 69,  0.55)",
        "glow-red":    "0 0 0 1px rgba(255, 77,  109, 0.35), 0 0 28px -6px rgba(255, 77,  109, 0.55)",
        "glow-yellow": "0 0 0 1px rgba(255, 233, 74,  0.35), 0 0 28px -6px rgba(255, 233, 74,  0.55)",
        "glow-pink":   "0 0 0 1px rgba(255, 93,  177, 0.35), 0 0 28px -6px rgba(255, 93,  177, 0.55)",
        "glow-blue":   "0 0 0 1px rgba(91,  140, 255, 0.35), 0 0 28px -6px rgba(91,  140, 255, 0.55)",
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.55" },
        },
      },
      animation: {
        pulseNeon: "pulseNeon 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
  safelist: [
    "shadow-glow-green", "shadow-glow-cyan", "shadow-glow-purple",
    "shadow-glow-orange", "shadow-glow-red", "shadow-glow-yellow",
    "shadow-glow-pink", "shadow-glow-blue",
    "text-neon-green", "text-neon-cyan", "text-neon-purple",
    "text-neon-orange", "text-neon-red", "text-neon-yellow",
    "text-neon-pink", "text-neon-blue",
    "stroke-neon-green", "stroke-neon-cyan", "stroke-neon-purple",
    "stroke-neon-orange", "stroke-neon-red", "stroke-neon-yellow",
    "stroke-neon-pink", "stroke-neon-blue",
    "bg-neon-green", "bg-neon-cyan", "bg-neon-purple",
    "bg-neon-orange", "bg-neon-red", "bg-neon-yellow",
    "bg-neon-pink", "bg-neon-blue",
  ],
};

export default config;
