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
      },
      fontFamily: {
        inter:   ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "Georgia", "serif"],
        manrope: ["var(--font-heading)", "Georgia", "serif"], /* backward compat alias */
      },
    },
  },
  plugins: [],
};
export default config;
