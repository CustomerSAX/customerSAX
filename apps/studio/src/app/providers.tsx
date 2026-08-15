"use client";

import { ApolloProvider } from "@apollo/client";
import { MeridianProvider } from "@csa/ui";
import type { ReactNode } from "react";
import { apolloClient } from "../graphql/client";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MeridianProvider defaultTheme="light">
      <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
    </MeridianProvider>
  );
}
