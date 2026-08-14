import type { Metadata } from 'next';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'customerSAX — Commerce customer service, built for resolution',
  description:
    'customerSAX is the commerce service operating layer connecting customer conversations to orders, CRM, payments, fulfillment, returns and governed AI actions.',
  openGraph: {
    title: 'customerSAX — Commerce customer service, built for resolution',
    description:
      'customerSAX connects every conversation to the commerce systems that can actually fix the problem — orders, CRM, payments, fulfillment, returns, loyalty and more.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'customerSAX',
    description: 'Commerce customer service, rebuilt around resolution.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
              "name": "customerSAX",
              "applicationCategory": "BusinessApplication",
              "description": "customerSAX is the commerce service operating layer connecting customer conversations to orders, CRM, payments, fulfillment, returns and governed AI actions.",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "about": {
                "@type": "Thing",
                "name": "AI Customer Service Platform for Commerce"
              }
            })
          }}
        />
      </head>
      <body>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}
