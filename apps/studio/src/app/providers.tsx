"use client";

import { ApolloProvider } from "@apollo/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MeridianProvider, UIProvider, resolveUIConfig } from "@csa/ui";
import type { ReactNode } from "react";
import { apolloClient } from "../graphql/client";
import { getQueryClient } from "../lib/query-client";
import { useCurrentUser } from "../lib/use-current-user";

function AppProvidersInner({ children }: { children: ReactNode }) {
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

export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvidersInner>{children}</AppProvidersInner>
    </QueryClientProvider>
  );
}
