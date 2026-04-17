import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0f1117",
          secondary: "#1a1d27",
          tertiary: "#232a3a",
        },
        accent: {
          blue: "#4f8cff",
          green: "#34d399",
          red: "#f87171",
          yellow: "#fbbf24",
          purple: "#a78bfa",
          orange: "#fb923c",
        },
        muted: "#94a3b8",
        border: "#2d3142",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 2px 4px rgba(0, 0, 0, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
