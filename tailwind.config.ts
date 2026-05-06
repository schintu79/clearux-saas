import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderColor: {
        DEFAULT: "var(--border)",
      },
      colors: {
        blue:       "var(--blue)",
        "blue-dk":  "var(--blue-dk)",
        "blue-lt":  "var(--blue-lt)",
        accent:     "var(--accent)",
        "accent-dk":"var(--accent-dk)",
        "accent-lt":"var(--accent-lt)",
        navy:       "var(--navy)",
        off:        "var(--off)",
        muted:      "var(--muted)",
        border:     "var(--border)",
        text:       "var(--text)",
        surface:    "var(--surface)",
        "surface-alt": "var(--surface-alt)",
        card:       "var(--card)",
        "card-hover":"var(--card-hover)",
        "input-bg": "var(--input-bg)",
        sidebar:    "var(--sidebar)",
        "sidebar-text":"var(--sidebar-text)",
        background: "var(--surface)",
        foreground: "var(--text)",
        brand:      "var(--brand)",
        "brand-hover": "var(--brand-hover)",
        "brand-light": "var(--brand-light)",
        lime:       "var(--lime)",
        "lime-hover":"var(--lime-hover)",
        "lime-soft": "var(--lime-soft)",
      },
      fontFamily: {
        body:    ["var(--font-body)", "system-ui", "sans-serif"],
        inter:   ["var(--font-body)", "system-ui", "sans-serif"], /* backward compat */
        heading: ["var(--font-body)", "system-ui", "sans-serif"],
        manrope: ["var(--font-body)", "system-ui", "sans-serif"], /* backward compat */
        handwriting: ["var(--font-handwriting)", "cursive"],
      },
    },
  },
  plugins: [],
};
export default config;
