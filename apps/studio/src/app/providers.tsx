"use client";

import { ApolloProvider } from "@apollo/client";
import { MeridianProvider, UIProvider, resolveUIConfig } from "@csa/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
import { ProjectLoading } from "../components/shell/ProjectLoading";
import { ProjectUrlBoundary } from "../components/shell/ProjectUrlBoundary";
import { PageContextProvider } from "../features/csa-assistant";
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
        <ApolloProvider client={apolloClient}>
          <PageContextProvider>
            <Suspense fallback={<ProjectLoading />}>
              <ProjectUrlBoundary>{children}</ProjectUrlBoundary>
            </Suspense>
          </PageContextProvider>
        </ApolloProvider>
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
