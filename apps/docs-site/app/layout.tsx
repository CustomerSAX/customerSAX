import "@fontsource-variable/inter";
// CSA palette tokens — single source of truth (packages/ui). Imported here so
// the custom properties are present on :root for both Tailwind's @theme mapping
// and the runtime Mermaid theming.
import "@csa/ui/styles/tokens.css";
import "./global.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "customerSAX Documentation",
    template: "%s · customerSAX Docs"
  },
  description:
    "Documentation for customerSAX — the AI-native commerce customer-service resolution platform."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light">
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <RootProvider search={{ enabled: false }} theme={{ enabled: false }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
