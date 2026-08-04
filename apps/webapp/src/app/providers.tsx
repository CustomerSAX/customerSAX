"use client";

import { ApolloProvider } from "@apollo/client";
import type { ReactNode } from "react";
import { apolloClient } from "../graphql/client";

export function AppProviders({ children }: { children: ReactNode }) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}

