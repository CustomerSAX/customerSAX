import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("socialDescription"),
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: "customerSAX",
      description: t("description")
    }
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const metadata = await getTranslations("Metadata");

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* AEO / GEO Schema Metadata */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "customerSAX",
              applicationCategory: "BusinessApplication",
              description: metadata("description"),
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD"
              },
              about: {
                "@type": "Thing",
                name: "AI Customer Service Platform for Commerce"
              }
            })
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider>
          <Navigation />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
