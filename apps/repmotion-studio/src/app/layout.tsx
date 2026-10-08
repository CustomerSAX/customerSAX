import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "./globals.css";
import { DemoProvider } from "../features/repmotion/demo-state";
import { Workspace } from "../features/repmotion/workspace";

export const metadata: Metadata = {
  title: "RepMotion Studio",
  description:
    "A connected sales workspace for account managers, customer care, and sales leaders."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoProvider>
          <Workspace>{children}</Workspace>
        </DemoProvider>
      </body>
    </html>
  );
}
