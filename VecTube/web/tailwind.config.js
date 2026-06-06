import daisyui from "daisyui";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [daisyui, typography],
  daisyui: {
    themes: [
      {
        vectube: {
          primary: "#6366f1",
          "primary-content": "#ffffff",
          secondary: "#8b5cf6",
          "secondary-content": "#ffffff",
          accent: "#06b6d4",
          "accent-content": "#ffffff",
          neutral: "#1e1b4b",
          "neutral-content": "#e2e8f0",
          "base-100": "#0f0f23",
          "base-200": "#0a0a1a",
          "base-300": "#161632",
          "base-content": "#e2e8f0",
          info: "#38bdf8",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
    ],
    darkTheme: "vectube",
  },
};
