import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          dark: "var(--surface-dark)",
          card: "var(--surface-card)",
          panel: "var(--surface-panel)",
          elevated: "var(--surface-elevated)",
          input: "var(--surface-input)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
          dark: "var(--border-dark)",
          darker: "var(--border-darker)",
          glow: "var(--border-glow)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          light: "var(--primary-light)",
          muted: "var(--primary-muted)",
        },
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          bg: "var(--danger-bg)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          dim: "var(--text-dim)",
        },
        badge: {
          purple: "var(--badge-purple)",
          "purple-bg": "var(--badge-purple-bg)",
          "purple-border": "var(--badge-purple-border)",
          blue: "var(--badge-blue)",
          "blue-bg": "var(--badge-blue-bg)",
          "blue-border": "var(--badge-blue-border)",
          orange: "var(--badge-orange)",
          "orange-bg": "var(--badge-orange-bg)",
          "orange-border": "var(--badge-orange-border)",
          green: "var(--badge-green)",
          "green-bg": "var(--badge-green-bg)",
          "green-border": "var(--badge-green-border)",
          amber: "var(--badge-amber)",
          "amber-bg": "var(--badge-amber-bg)",
          "amber-border": "var(--badge-amber-border)",
          slate: "var(--badge-slate)",
          "slate-bg": "var(--badge-slate-bg)",
          "slate-border": "var(--badge-slate-border)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
