"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Badge, Button, Card, Icon } from "@csa/ui";
import { AppShell } from "@/components/shell/AppShell";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  ADMIN_CLIENT_QUERY,
  ADMIN_SAVE_PROJECT_TICKETING,
  ADMIN_UPDATE_AI_SETTINGS,
  ADMIN_CREATE_SMTP_PROFILE,
  ADMIN_UPDATE_CLIENT
} from "@/features/superadmin/api/queries";
import {
  CONNECTOR_CATEGORIES,
  type ConnectorCategoryKey,
  type ConnectorConfig
} from "@/features/onboarding/connectors.config";
import { ConnectorConfigModal } from "@/features/onboarding/components/ConnectorConfigModal";
import { getProviderLogo } from "@/features/onboarding/components/ProviderLogo";
import type { OnboardingState } from "@/features/onboarding/types";
import { CrmConnectorModal } from "@/features/crm/CrmConnectorModal";
import { activeConnectorId } from "./connector-status";

export function StudioConnectorsView({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useCurrentUser();
  const clientId = user?.activeClientId || user?.organization?.id;
  const isOrgAdmin = user?.role === "admin" || user?.role === "superadmin";

  const { data, loading, error, refetch } = useQuery(ADMIN_CLIENT_QUERY, {
    variables: { id: clientId },
    skip: !clientId || !isOrgAdmin,
    fetchPolicy: "cache-and-network"
  });

  const [expandedCategories, setExpandedCategories] = useState<Record<ConnectorCategoryKey, boolean>>({
    "product-search": true,
    "ticketing": true,
    "ai": true,
    "communication": false,
    "payments": false,
    "sso": false,
    "crm": false
  });

  const [selectedConnector, setSelectedConnector] = useState<ConnectorConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // CRM is configured per project with its own form (credentials, test, account reservation).
  const [crmConnectorId, setCrmConnectorId] = useState<string | null>(null);

  // Mutations
  const [saveTicketing] = useMutation(ADMIN_SAVE_PROJECT_TICKETING);
  const [updateAi] = useMutation(ADMIN_UPDATE_AI_SETTINGS);
  const [createSmtp] = useMutation(ADMIN_CREATE_SMTP_PROFILE);
  const [updateClient] = useMutation(ADMIN_UPDATE_CLIENT);

  // Derive status directly from saved data, including when the active project changes.
  const state = useMemo<OnboardingState>(() => {
    const client = data?.adminClient || {};
    const projects = data?.adminProjectsByClient || [];
    const ai = data?.adminAiSettings;
    const smtpProfiles = data?.adminSmtpProfilesByClient || [];
    const activeProject = projects.find((p: any) => p.projectKey === user?.activeProjectKey) || projects[0];

    return {
      name: client.name || "",
      slug: client.slug || "",
      contactEmail: client.contactEmail || "",
      uiTheme: client.uiTheme || "csa-custom",
      projects: projects.map((p: any) => ({
        id: p.id,
        projectKey: p.projectKey,
        displayName: p.displayName || p.projectKey,
        platform: p.platform || "commercetools",
        shellMode: p.standaloneB2bEnabled ? "b2b" : "b2c",
        isExisting: true
      })),
      ticketing: {
        provider: (activeProject?.ticketingProvider || "internal") as any
      },
      search: { provider: activeProject?.productsProvider === "algolia" ? "algolia" : "native" },
      crm: { provider: activeProject?.crmProvider || "none" },
      aiSettings: {
        enabled: Boolean(ai?.enabled),
        provider: (ai?.provider === "anthropic" ? "anthropic" : "openai") as any,
        displayName: ai?.displayName || "CSA Assistant",
        model: ai?.model || "gpt-4o-mini"
      },
      smtpProfile: {
        enabled: smtpProfiles.length > 0,
        name: smtpProfiles[0]?.name || "Default SMTP",
        smtpHost: smtpProfiles[0]?.smtpHost || "",
        smtpPort: smtpProfiles[0]?.smtpPort || 587,
        smtpSecure: smtpProfiles[0]?.smtpSecure ?? true,
        emailFrom: smtpProfiles[0]?.emailFrom || "",
        smtpUser: smtpProfiles[0]?.smtpUser || ""
      },
      ssoConfig: {
        provider: (client.ssoConfig?.provider || "none") as any,
        issuer: client.ssoConfig?.issuer || "",
        clientId: client.ssoConfig?.clientId || "",
        providerDisplayName: client.ssoConfig?.providerDisplayName || "",
        entryPointUrl: client.ssoConfig?.entryPointUrl || ""
      },
      teamMembers: []
    };
  }, [data, user?.activeProjectKey]);

  const toggleCategory = (categoryKey: ConnectorCategoryKey) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const handleOpenConnector = (connector: ConnectorConfig) => {
    if (connector.category === "crm") {
      setCrmConnectorId(connector.id);
      return;
    }
    setSelectedConnector(connector);
    setIsModalOpen(true);
  };

  const handleSaveConnector = async (patch: Partial<OnboardingState>) => {
    setSaveError(null);
    setIsModalOpen(false);

    try {
      if (patch.ticketing && clientId) {
        const projects = data?.adminProjectsByClient || [];
        const proj = projects.find((project: { projectKey: string }) => project.projectKey === user?.activeProjectKey);
        if (!proj) throw new Error("Select a project before saving ticketing credentials.");
        await saveTicketing({
          variables: {
            clientId,
            id: proj.id,
            input: {
              provider: patch.ticketing.provider,
              subdomain: patch.ticketing.subdomain,
              clientId: patch.ticketing.clientId,
              clientSecret: patch.ticketing.clientSecret,
              freshdeskDomain: patch.ticketing.freshdeskDomain,
              freshdeskApiKey: patch.ticketing.freshdeskApiKey
            }
          }
        });
      }

      if (patch.aiSettings && clientId) {
        await updateAi({
          variables: {
            clientId,
            input: {
              enabled: patch.aiSettings.enabled,
              provider: patch.aiSettings.provider,
              displayName: patch.aiSettings.displayName,
              model: patch.aiSettings.model,
              baseUrl: patch.aiSettings.baseUrl,
              apiKey: patch.aiSettings.apiKey
            }
          }
        });
      }

      if (patch.smtpProfile && patch.smtpProfile.enabled && clientId) {
        await createSmtp({
          variables: {
            clientId,
            input: {
              name: patch.smtpProfile.name,
              smtpHost: patch.smtpProfile.smtpHost,
              smtpPort: patch.smtpProfile.smtpPort,
              smtpSecure: patch.smtpProfile.smtpSecure,
              emailFrom: patch.smtpProfile.emailFrom,
              smtpUser: patch.smtpProfile.smtpUser,
              smtpPassword: patch.smtpProfile.smtpPassword,
              isDefault: true
            }
          }
        });
      }

      if (patch.ssoConfig && clientId) {
        await updateClient({
          variables: {
            id: clientId,
            ssoConfig: {
              provider: patch.ssoConfig.provider,
              issuer: patch.ssoConfig.issuer,
              clientId: patch.ssoConfig.clientId,
              clientSecret: patch.ssoConfig.clientSecret,
              providerDisplayName: patch.ssoConfig.providerDisplayName,
              entryPointUrl: patch.ssoConfig.entryPointUrl,
              idpCertPem: patch.ssoConfig.idpCertPem
            }
          }
        });
      }

      await refetch();
      setSaveSuccessMsg("Connector configuration updated successfully.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Could not save connector configuration. Please try again.");
    }
  };

  const content = (
    <div className={embedded ? "space-y-6" : "space-y-6 p-6"}>
      {/* Header */}
      <div>
        {!embedded && (
          <p className="text-xs font-bold uppercase tracking-widest text-m-primary">
            Organization / Connectors & Integrations
          </p>
        )}
        <h2 className={embedded ? "text-lg font-bold text-m-text" : "text-2xl font-bold text-m-text"}>
          Connectors & Integrations
        </h2>
        <p className="mt-0.5 text-xs text-m-text-muted">
          Manage third-party search, ticketing, AI assistants, email routing, and SSO integrations.
          When unconfigured, native platform capabilities remain active automatically with zero configuration.
        </p>
      </div>

        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        {/* Success Alert */}
        {saveSuccessMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
            <Icon name="check" size="sm" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Categories List */}
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-m-border bg-m-surface p-12 text-sm text-m-text-muted">
            <Icon name="loader" className="mr-2 animate-spin" size="sm" />
            Loading connector configurations...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-600 dark:text-red-400">
            Error loading connectors: {error.message}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {CONNECTOR_CATEGORIES.map((category) => {
              const isExpanded = expandedCategories[category.id] ?? false;
              const activeId = activeConnectorId(category.id, state);
              const connectors = category.connectors.filter((connector) => connector.isAvailable);
              const activeConnector = connectors.find((connector) => connector.id === activeId);
              const isNativeActive = category.nativeIntegration.id === activeId;

              return (
                <Card
                  key={category.id}
                  className="border border-m-border bg-m-surface overflow-hidden shadow-m-card transition-all"
                >
                  {/* Category Collapsible Header */}
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-m-surface-subtle/50 select-none"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-m-lg transition-colors ${
                          activeConnector
                            ? "bg-m-primary text-white"
                            : "bg-m-neutral-100 text-m-text"
                        }`}
                      >
                        <Icon name={category.icon} size="sm" />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-m-text tracking-tight">
                            {category.name}
                          </span>
                          {category.badge && (
                            <Badge variant="neutral" appearance="subtle" size="sm" className="hidden sm:inline-flex text-[10px]">
                              {category.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-m-text-muted mt-0.5 line-clamp-1">
                          {category.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {activeConnector ? (
                        <Badge variant="success" size="sm">
                          {activeConnector.name} Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" appearance="subtle" size="sm">
                          {isNativeActive ? `${category.nativeIntegration.name} Active` : "No active connector"}
                        </Badge>
                      )}
                      <Icon
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size="sm"
                        className="text-m-text-muted"
                      />
                    </div>
                  </div>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="border-t border-m-border/60 bg-m-surface-subtle/20 p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className={`flex flex-col rounded-m-lg border p-4 bg-m-surface ${isNativeActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-m-border"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-m-md bg-m-surface-subtle border border-m-border/60">
                                <Icon name={category.nativeIntegration.icon} size="sm" />
                              </div>
                              <div>
                                <span className="block text-sm font-bold text-m-text leading-tight">{category.nativeIntegration.name}</span>
                                <span className="text-[10px] text-m-text-muted uppercase tracking-wider font-semibold">Native</span>
                              </div>
                            </div>
                            {isNativeActive && (
                              <span role="img" aria-label="Active connector" title="Active connector" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <Icon name="check" size="sm" />
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-xs text-m-text-muted">{category.nativeIntegration.description}</p>
                        </div>
                        {connectors.map((connector) => {
                          const isConfigured = connector.id === activeId;

                          return (
                            <div
                              key={connector.id}
                              className={`flex flex-col justify-between rounded-m-lg border p-4 bg-m-surface transition-all ${
                                isConfigured
                                  ? "border-emerald-500/40 bg-emerald-500/5 shadow-xs"
                                  : "border-m-border hover:border-m-text-muted/40"
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-m-md bg-m-surface-subtle border border-m-border/60">
                                      {getProviderLogo(connector.id, "sm")}
                                    </div>
                                    <div>
                                      <span className="text-sm font-bold text-m-text block leading-tight">
                                        {connector.name}
                                      </span>
                                      <span className="text-[10px] text-m-text-muted uppercase tracking-wider font-semibold">
                                        {connector.category}
                                      </span>
                                    </div>
                                  </div>

                                  {isConfigured ? (
                                    <span role="img" aria-label="Active connector" title="Active connector" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                                      <Icon name="check" size="sm" />
                                    </span>
                                  ) : (
                                    <Badge variant="neutral" appearance="subtle" size="sm">
                                      Available
                                    </Badge>
                                  )}
                                </div>

                                <p className="text-xs text-m-text-muted line-clamp-2 mt-1">
                                  {connector.description}
                                </p>
                              </div>

                              <div className="mt-4 pt-3 border-t border-m-border/40 flex items-center justify-end">
                                <Button
                                  size="sm"
                                  variant={isConfigured ? "outline" : "primary"}
                                  onClick={() => handleOpenConnector(connector)}
                                  className="w-full text-xs"
                                >
                                  <Icon name="settings" size="xs" className="mr-1.5" />
                                  {isConfigured ? "Configure" : "Connect"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );

  const projectRows = data?.adminProjectsByClient || [];
  const modal = (
    <>
      <ConnectorConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        connector={selectedConnector ? {
          ...selectedConnector,
          isConfigured: (savedState) => activeConnectorId(selectedConnector.category, savedState) === selectedConnector.id
        } : null}
        state={state}
        onSave={handleSaveConnector}
      />
      {crmConnectorId && clientId && (
        <CrmConnectorModal
          isOpen
          onClose={() => setCrmConnectorId(null)}
          clientId={clientId}
          projects={projectRows.map((p: any) => ({
            id: p.id,
            projectKey: p.projectKey,
            displayName: p.displayName || p.projectKey,
            crmProvider: p.crmProvider
          }))}
          initialProjectId={(projectRows.find((p: any) => p.projectKey === user?.activeProjectKey) || projectRows[0])?.id}
          initialProvider={crmConnectorId}
          onSaved={() => void refetch()}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <>
        {content}
        {modal}
      </>
    );
  }

  return (
    <AppShell>
      {content}
      {modal}
    </AppShell>
  );
}
