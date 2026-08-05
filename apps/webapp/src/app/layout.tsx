import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import { AppProviders } from "./providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "CSA Admin",
  description: "Commerce Customer Service Accelerator internal agent portal"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
