import "@fontsource-variable/inter";
// CSA palette tokens — single source of truth (packages/ui). Imported here so
// the custom properties are present on :root for both Tailwind's @theme mapping
// and the runtime Mermaid theming.
import "@csa/ui/styles/tokens.css";
import "./global.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: {
      default: t("title"),
      template: t("titleTemplate")
    },
    description: t("description")
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="light">
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <NextIntlClientProvider>
          <RootProvider search={{ enabled: false }} theme={{ enabled: false }}>
            {children}
          </RootProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
