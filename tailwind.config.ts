import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ['variant', '&:is(.dark *):not(.theme-light *)'],
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
      maxWidth: {
        'mkt': '1320px',
      },
      colors: {
        /* Marketing V2 tokens */
        paper: 'var(--paper)',
        'paper-2': 'var(--paper-2)',
        'paper-3': 'var(--paper-3)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'm-muted': 'var(--m-muted)',
        'm-muted-2': 'var(--m-muted-2)',
        rule: 'var(--rule)',
        'rule-2': 'var(--rule-2)',
        signal: 'var(--signal)',
        'signal-hot': 'var(--signal-hot)',
        severe: 'var(--severe)',
        warn: 'var(--warn)',
        ok: 'var(--ok)',
        /* Existing tokens */
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
        /* Marketing V2 fonts */
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "-apple-system", "sans-serif"],
        /* Existing fonts */
        body:    ["var(--font-body)", "system-ui", "sans-serif"],
        inter:   ["var(--font-body)", "system-ui", "sans-serif"], /* backward compat */
        heading: ["var(--font-heading)", "var(--font-body)", "system-ui", "sans-serif"],
        manrope: ["var(--font-body)", "system-ui", "sans-serif"], /* backward compat */
        handwriting: ["var(--font-handwriting)", "cursive"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
