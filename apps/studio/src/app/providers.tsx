"use client";

import { ApolloProvider } from "@apollo/client";
import { MeridianProvider, UIProvider, resolveUIConfig } from "@csa/ui";
import type { ReactNode } from "react";
import { apolloClient } from "../graphql/client";
import { useCurrentUser } from "../lib/use-current-user";

export function AppProviders({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  const uiConfig = resolveUIConfig({
    customerId: user?.activeClientId || user?.tenantId,
    projectId: user?.activeProjectKey,
    organizationId: user?.activeClientId || user?.organization?.id,
    organizationName: user?.organization?.name,
    user,
  });

  return (

    <MeridianProvider defaultTheme="light">
      <UIProvider config={uiConfig}>
        <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
      </UIProvider>
    </MeridianProvider>
  );
}
