import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppProviders } from "./providers";
import { Workspace } from "../features/repmotion/workspace";

export const metadata: Metadata = {
  title: "RepMotion Studio",
  description:
    "A connected sales workspace for account managers, customer care, and sales leaders."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light" data-theme="light">
      <body className="font-sans">
        <AppProviders>
          <Workspace>{children}</Workspace>
        </AppProviders>
      </body>
    </html>
  );
}
