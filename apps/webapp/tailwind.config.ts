import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
          DEFAULT: "#2563EB",
          foreground: "#ffffff"
        },
        "csa-bg": "var(--content-bg)",
        "csa-border": "var(--border-subtle)",
        "csa-border-strong": "var(--border-strong)",
        "csa-muted": "var(--text-muted)",
        "csa-navy": "var(--color-ink)",
        "csa-primary": "var(--color-primary)",
        "csa-primary-strong": "var(--color-primary-strong)",
        "csa-surface": "var(--surface-1)",
        "csa-surface-2": "var(--surface-2)",
        "csa-success": "var(--color-success)",
        "csa-warning": "var(--color-warning)",
        "csa-error": "var(--color-error)",
        "csa-info": "var(--color-info)"
      },
      fontFamily: {
        sans: ["var(--font-family)"]
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        panel: "var(--radius-panel)"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        panel: "var(--shadow-panel)",
        modal: "var(--shadow-modal)"
      },
      transitionTimingFunction: {
        enterprise: "var(--ease-enterprise)"
      }
    }
  },
  plugins: []
};

export default config;
