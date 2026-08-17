import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/**
 * Shared layout options for the navbar (home layout + docs layout).
 * The brand mark is rendered as inline SVG so it inherits the CSA blue via
 * currentColor (--color-fd-primary) with a yellow accent dot.
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <rect
            x="2"
            y="2"
            width="20"
            height="20"
            rx="6"
            fill="var(--csa-blue-500)"
          />
          <circle cx="17" cy="7" r="3" fill="var(--csa-yellow-500)" />
          <path
            d="M8 15.5c0-2.2 1.8-4 4-4"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontWeight: 700 }}>customerSAX Docs</span>
      </span>
    )
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url"
    }
  ]
};
