import Link from "next/link";

const sections = [
  {
    title: "Getting Started",
    body: "Run the whole platform locally, learn the service map and ports.",
    href: "/docs/getting-started"
  },
  {
    title: "Architecture & Flows",
    body: "Service topology, the platform-neutral commerce seam, the resolution flow.",
    href: "/docs/architecture"
  },
  {
    title: "API Reference",
    body: "The federated GraphQL BFF surface, the ai-assist /chat endpoint, auth REST.",
    href: "/docs/api-reference"
  },
  {
    title: "Service Documentation",
    body: "One page per service: auth, ai-assist, bff, commercetools, ticketing, admin.",
    href: "/docs/services"
  }
];

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: "60rem",
        margin: "0 auto",
        padding: "4rem 1.5rem 5rem"
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "0.25rem 0.75rem",
          borderRadius: "9999px",
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--csa-blue-700)",
          background: "var(--csa-blue-50)",
          border: "1px solid var(--csa-blue-200)"
        }}
      >
        AI-native customer service
      </span>

      <h1
        style={{
          fontSize: "2.75rem",
          lineHeight: 1.1,
          fontWeight: 800,
          margin: "1.25rem 0 0",
          letterSpacing: "-0.02em"
        }}
      >
        customerSAX{" "}
        <span style={{ color: "var(--csa-blue-500)" }}>Documentation</span>
      </h1>

      <p
        style={{
          fontSize: "1.125rem",
          color: "var(--color-fd-muted-foreground)",
          maxWidth: "40rem",
          marginTop: "1rem"
        }}
      >
        customerSAX (CSA) is an AI-native commerce customer-service resolution
        platform. A support rep works orders, carts, returns and tickets through
        guided steppers or free-form chat — both paths call the same backend
        tools, so they produce identical, real results.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.75rem" }}>
        <Link
          href="/docs"
          style={{
            padding: "0.7rem 1.25rem",
            borderRadius: "0.625rem",
            fontWeight: 600,
            color: "#fff",
            background: "var(--csa-blue-500)",
            boxShadow: "var(--shadow-primary)"
          }}
        >
          Read the docs
        </Link>
        <Link
          href="/docs/architecture"
          style={{
            padding: "0.7rem 1.25rem",
            borderRadius: "0.625rem",
            fontWeight: 600,
            color: "var(--csa-navy-950)",
            background: "var(--csa-yellow-500)"
          }}
        >
          Architecture
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
          gap: "1rem",
          marginTop: "3rem"
        }}
      >
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "block",
              padding: "1.25rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--color-fd-border)",
              background: "var(--color-fd-card)",
              textDecoration: "none"
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "var(--color-fd-card-foreground)"
              }}
            >
              {s.title}
            </div>
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "0.9rem",
                color: "var(--color-fd-muted-foreground)"
              }}
            >
              {s.body}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
