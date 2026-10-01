"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader } from "@csa/ui";
import { CONNECTOR_CATEGORIES, type ConnectorConfig } from "../connectors.config";
import type { OnboardingState } from "../types";
import { getProviderLogo } from "./ProviderLogo";

interface ConnectorConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  connector: ConnectorConfig | null;
  state: OnboardingState;
  onSave: (patch: Partial<OnboardingState>) => void;
}

export function ConnectorConfigModal({
  isOpen,
  onClose,
  connector,
  state,
  onSave
}: ConnectorConfigModalProps) {
  // Form draft states
  // Algolia
  const [algoliaAppId, setAlgoliaAppId] = useState("");
  const [algoliaSearchApiKey, setAlgoliaSearchApiKey] = useState("");
  const [algoliaIndexName, setAlgoliaIndexName] = useState("");

  // Zendesk
  const [zendeskSubdomain, setZendeskSubdomain] = useState("");
  const [zendeskClientId, setZendeskClientId] = useState("");
  const [zendeskClientSecret, setZendeskClientSecret] = useState("");

  // Freshdesk
  const [freshdeskDomain, setFreshdeskDomain] = useState("");
  const [freshdeskApiKey, setFreshdeskApiKey] = useState("");

  // AI (OpenAI / Anthropic)
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiDisplayName, setAiDisplayName] = useState("CSA Assistant");

  // SMTP
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpEmailFrom, setSmtpEmailFrom] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");

  // SSO (OIDC / SAML)
  const [oidcIssuer, setOidcIssuer] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [samlEntryPoint, setSamlEntryPoint] = useState("");
  const [samlIssuer, setSamlIssuer] = useState("");

  const [error, setError] = useState<string | null>(null);

  // Sync state into draft when modal opens or connector changes
  useEffect(() => {
    if (!connector || !isOpen) return;

    setError(null);

    if (connector.id === "algolia") {
      setAlgoliaAppId(state.search?.appId || "");
      setAlgoliaSearchApiKey(state.search?.searchApiKey || "");
      setAlgoliaIndexName(state.search?.indexName || "");
    } else if (connector.id === "zendesk") {
      setZendeskSubdomain(state.ticketing?.subdomain || "");
      setZendeskClientId(state.ticketing?.clientId || "");
      setZendeskClientSecret(state.ticketing?.clientSecret || "");
    } else if (connector.id === "freshdesk") {
      setFreshdeskDomain(state.ticketing?.freshdeskDomain || "");
      setFreshdeskApiKey(state.ticketing?.freshdeskApiKey || "");
    } else if (connector.id === "openai" || connector.id === "anthropic") {
      const isCurrentProvider = state.aiSettings?.provider === connector.id;
      setAiApiKey(isCurrentProvider ? state.aiSettings?.apiKey || "" : "");
      setAiModel(
        isCurrentProvider && state.aiSettings?.model
          ? state.aiSettings.model
          : connector.id === "openai"
            ? "gpt-4o-mini"
            : "claude-3-5-sonnet-20241022"
      );
      setAiDisplayName(state.aiSettings?.displayName || "CSA Assistant");
    } else if (connector.id === "smtp") {
      setSmtpHost(state.smtpProfile?.smtpHost || "");
      setSmtpPort(state.smtpProfile?.smtpPort || 587);
      setSmtpEmailFrom(state.smtpProfile?.emailFrom || "");
      setSmtpUser(state.smtpProfile?.smtpUser || "");
      setSmtpPassword(state.smtpProfile?.smtpPassword || "");
    } else if (connector.id === "oidc") {
      setOidcIssuer(state.ssoConfig?.issuer || "");
      setOidcClientId(state.ssoConfig?.clientId || "");
      setOidcClientSecret(state.ssoConfig?.clientSecret || "");
    } else if (connector.id === "saml") {
      setSamlEntryPoint(state.ssoConfig?.entryPointUrl || "");
      setSamlIssuer(state.ssoConfig?.issuer || "");
    }
  }, [connector, isOpen, state]);

  if (!connector) return null;

  const isConfigured = connector.isConfigured ? connector.isConfigured(state) : false;
  const logo = getProviderLogo(connector.id);
  const parentCategory = CONNECTOR_CATEGORIES.find((cat) => cat.id === connector.category);

  const handleSave = () => {
    setError(null);

    switch (connector.id) {
      case "algolia": {
        if (!algoliaAppId.trim()) {
          setError("Algolia Application ID is required.");
          return;
        }
        if (!algoliaSearchApiKey.trim()) {
          setError("Search-Only API Key is required.");
          return;
        }
        if (!algoliaIndexName.trim()) {
          setError("Primary Index Name is required.");
          return;
        }
        onSave({
          search: {
            ...state.search,
            provider: "algolia",
            appId: algoliaAppId.trim(),
            searchApiKey: algoliaSearchApiKey.trim(),
            indexName: algoliaIndexName.trim(),
            testedOk: true
          }
        });
        break;
      }
      case "zendesk": {
        const cleanSubdomain = zendeskSubdomain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\.zendesk\.com.*$/, "");
        if (!cleanSubdomain) {
          setError("Zendesk Subdomain is required.");
          return;
        }
        if (!zendeskClientId.trim()) {
          setError("OAuth Client ID is required.");
          return;
        }
        if (!zendeskClientSecret.trim()) {
          setError("Client Secret is required.");
          return;
        }
        onSave({
          ticketing: {
            ...state.ticketing,
            provider: "zendesk",
            subdomain: cleanSubdomain,
            clientId: zendeskClientId.trim(),
            clientSecret: zendeskClientSecret.trim(),
            testedOk: true
          }
        });
        break;
      }
      case "freshdesk": {
        const cleanDomain = freshdeskDomain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\.freshdesk\.com.*$/, "");
        if (!cleanDomain) {
          setError("Freshdesk Domain is required.");
          return;
        }
        if (!freshdeskApiKey.trim()) {
          setError("Freshdesk API Key is required.");
          return;
        }
        onSave({
          ticketing: {
            ...state.ticketing,
            provider: "freshdesk",
            freshdeskDomain: cleanDomain,
            freshdeskApiKey: freshdeskApiKey.trim(),
            testedOk: true
          }
        });
        break;
      }
      case "openai":
      case "anthropic": {
        if (!aiApiKey.trim()) {
          setError("Provider API Key is required.");
          return;
        }
        onSave({
          aiSettings: {
            ...state.aiSettings,
            enabled: true,
            provider: connector.id as "openai" | "anthropic",
            apiKey: aiApiKey.trim(),
            model: aiModel.trim() || (connector.id === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20241022"),
            displayName: aiDisplayName.trim() || "CSA Assistant"
          }
        });
        break;
      }
      case "smtp": {
        if (!smtpHost.trim()) {
          setError("SMTP Server Host is required.");
          return;
        }
        if (!smtpEmailFrom.trim() || !smtpEmailFrom.includes("@")) {
          setError("A valid Sender (From) Email Address is required.");
          return;
        }
        onSave({
          smtpProfile: {
            ...state.smtpProfile,
            enabled: true,
            smtpHost: smtpHost.trim(),
            smtpPort: Number(smtpPort) || 587,
            smtpSecure: smtpPort === 465,
            emailFrom: smtpEmailFrom.trim(),
            smtpUser: smtpUser.trim() || undefined,
            smtpPassword: smtpPassword.trim() || undefined
          }
        });
        break;
      }
      case "oidc": {
        if (!oidcIssuer.trim()) {
          setError("OIDC Issuer URL is required.");
          return;
        }
        if (!oidcClientId.trim()) {
          setError("Client ID is required.");
          return;
        }
        onSave({
          ssoConfig: {
            ...state.ssoConfig,
            provider: "oidc",
            issuer: oidcIssuer.trim(),
            clientId: oidcClientId.trim(),
            clientSecret: oidcClientSecret.trim() || undefined
          }
        });
        break;
      }
      case "saml": {
        if (!samlEntryPoint.trim()) {
          setError("IdP Entry Point URL is required.");
          return;
        }
        onSave({
          ssoConfig: {
            ...state.ssoConfig,
            provider: "saml",
            entryPointUrl: samlEntryPoint.trim(),
            issuer: samlIssuer.trim() || undefined
          }
        });
        break;
      }
      default:
        break;
    }

    onClose();
  };

  const handleDisconnect = () => {
    switch (connector.category) {
      case "product-search":
        onSave({
          search: {
            provider: "native"
          }
        });
        break;
      case "ticketing":
        onSave({
          ticketing: {
            provider: "internal"
          }
        });
        break;
      case "ai":
        onSave({
          aiSettings: {
            ...state.aiSettings,
            enabled: false
          }
        });
        break;
      case "communication":
        onSave({
          smtpProfile: {
            ...state.smtpProfile,
            enabled: false
          }
        });
        break;
      case "sso":
        onSave({
          ssoConfig: {
            provider: "none"
          }
        });
        break;
      default:
        break;
    }

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-m-lg border border-m-border bg-white p-1.5 shadow-xs">
              {logo || (connector.icon ? <Icon name={connector.icon} size="sm" /> : <Icon name="layers" size="sm" />)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-m-text">{connector.name}</span>
                {isConfigured && (
                  <Badge variant="success" size="sm">
                    Connected
                  </Badge>
                )}
                {connector.badge && !isConfigured && (
                  <Badge variant={connector.badgeTone || "neutral"} appearance="subtle" size="sm">
                    {connector.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-m-text-muted">{parentCategory?.name}</span>
            </div>
          </div>
        }
        onClose={onClose}
      />

      <ModalBody className="p-6">
        {/* Error notification */}
        {error && (
          <div className="mb-4 rounded-m-lg border border-m-error-border bg-m-error-light/50 p-3 text-xs text-m-error flex items-center gap-2">
            <Icon name="alert-circle" size="xs" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Coming Soon Connector View */}
        {!connector.isAvailable ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-m-neutral-100 text-m-text-muted">
              {logo || <Icon name="clock" size="md" />}
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <span className="text-sm font-bold text-m-text">{connector.name} is on the Near-Term Roadmap</span>
              <p className="text-xs text-m-text-muted leading-relaxed">
                {connector.description}
              </p>
              <div className="mt-2 text-xs font-semibold text-m-primary bg-m-primary-50 py-1.5 px-3 rounded-m-md">
                Native commerce handling is active by default. No setup needed.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-m-text-muted leading-relaxed">
              {connector.description}
            </p>

            {/* 1. Algolia Form */}
            {connector.id === "algolia" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    Algolia Application ID <span className="text-m-error">*</span>
                  </label>
                  <Input
                    value={algoliaAppId}
                    onChange={(e) => setAlgoliaAppId(e.target.value.trim())}
                    placeholder="e.g. LAT67PQXYZ"
                    className="font-mono text-xs"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    Search-Only API Key <span className="text-m-error">*</span>
                  </label>
                  <Input
                    type="password"
                    value={algoliaSearchApiKey}
                    onChange={(e) => setAlgoliaSearchApiKey(e.target.value.trim())}
                    placeholder="e.g. 9b72ec7125ff..."
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    Primary Index Name <span className="text-m-error">*</span>
                  </label>
                  <Input
                    value={algoliaIndexName}
                    onChange={(e) => setAlgoliaIndexName(e.target.value.trim())}
                    placeholder="e.g. prod_catalog"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex items-start gap-2.5 rounded-m-md border border-m-warning-border bg-m-warning-light p-3 text-xs text-m-warning-dark">
                  <Icon name="shield-alert" size="xs" className="mt-0.5 shrink-0" />
                  <span>
                    <strong>Security Guardrail:</strong> Always supply a <em>Search-Only API Key</em>. Never provide
                    an Admin or Write key. The key is strictly used for querying the product search index from customer views.
                  </span>
                </div>
              </div>
            )}

            {/* 2. Zendesk Form */}
            {connector.id === "zendesk" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    Zendesk Subdomain <span className="text-m-error">*</span>
                  </label>
                  <div className="flex items-center">
                    <Input
                      value={zendeskSubdomain}
                      onChange={(e) => setZendeskSubdomain(e.target.value)}
                      placeholder="mycompany"
                      className="font-mono text-xs rounded-r-none"
                      autoFocus
                    />
                    <span className="inline-flex h-10 items-center border border-l-0 border-m-border bg-m-neutral-100 px-3 text-xs text-m-text-muted rounded-r-m-md">
                      .zendesk.com
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    OAuth Client ID <span className="text-m-error">*</span>
                  </label>
                  <Input
                    value={zendeskClientId}
                    onChange={(e) => setZendeskClientId(e.target.value.trim())}
                    placeholder="e.g. csa_support_client"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    Client Secret <span className="text-m-error">*</span>
                  </label>
                  <Input
                    type="password"
                    value={zendeskClientSecret}
                    onChange={(e) => setZendeskClientSecret(e.target.value.trim())}
                    placeholder="••••••••••••••••"
                  />
                </div>

                <p className="text-[11px] text-m-text-muted leading-relaxed">
                  Use a confidential Zendesk OAuth client with <code className="font-mono text-m-text">read</code> and{" "}
                  <code className="font-mono text-m-text">tickets:write</code> scopes. CSA will automatically authenticate
                  and sync support inquiries.
                </p>
              </div>
            )}

            {/* 3. Freshdesk Form */}
            {connector.id === "freshdesk" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    Freshdesk Domain <span className="text-m-error">*</span>
                  </label>
                  <div className="flex items-center">
                    <Input
                      value={freshdeskDomain}
                      onChange={(e) => setFreshdeskDomain(e.target.value)}
                      placeholder="mycompany"
                      className="font-mono text-xs rounded-r-none"
                      autoFocus
                    />
                    <span className="inline-flex h-10 items-center border border-l-0 border-m-border bg-m-neutral-100 px-3 text-xs text-m-text-muted rounded-r-m-md">
                      .freshdesk.com
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    API Key <span className="text-m-error">*</span>
                  </label>
                  <Input
                    type="password"
                    value={freshdeskApiKey}
                    onChange={(e) => setFreshdeskApiKey(e.target.value.trim())}
                    placeholder="Freshdesk API token"
                  />
                </div>

                <p className="text-[11px] text-m-text-muted leading-relaxed">
                  Find your API key in Freshdesk under Profile Settings → View API Key.
                </p>
              </div>
            )}

            {/* 4. AI Form (OpenAI / Anthropic) */}
            {(connector.id === "openai" || connector.id === "anthropic") && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    {connector.name} API Key <span className="text-m-error">*</span>
                  </label>
                  <Input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value.trim())}
                    placeholder={connector.id === "openai" ? "sk-proj-••••••••" : "sk-ant-••••••••"}
                    className="font-mono text-xs"
                    autoFocus
                  />
                  <span className="text-[11px] text-m-text-muted">
                    API keys are encrypted at rest with AES-256-GCM.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-m-text">Model Identifier</label>
                    <Input
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value.trim())}
                      placeholder={connector.id === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20241022"}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-m-text">Assistant Display Name</label>
                    <Input
                      value={aiDisplayName}
                      onChange={(e) => setAiDisplayName(e.target.value)}
                      placeholder="CSA Assistant"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. Custom SMTP Form */}
            {connector.id === "smtp" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-m-text">
                      SMTP Host <span className="text-m-error">*</span>
                    </label>
                    <Input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value.trim())}
                      placeholder="smtp.sendgrid.net"
                      className="font-mono text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-m-text">Port</label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                      placeholder="587"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    Sender (From) Email Address <span className="text-m-error">*</span>
                  </label>
                  <Input
                    type="email"
                    value={smtpEmailFrom}
                    onChange={(e) => setSmtpEmailFrom(e.target.value.trim())}
                    placeholder="support@mycompany.com"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-m-text">Username (Optional)</label>
                    <Input
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value.trim())}
                      placeholder="apikey or username"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-m-text">Password / Token (Optional)</label>
                    <Input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value.trim())}
                      placeholder="••••••••••••"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 6. OIDC Form */}
            {connector.id === "oidc" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    OIDC Issuer URL <span className="text-m-error">*</span>
                  </label>
                  <Input
                    value={oidcIssuer}
                    onChange={(e) => setOidcIssuer(e.target.value.trim())}
                    placeholder="https://login.microsoftonline.com/{tenant-id}/v2.0"
                    className="font-mono text-xs"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-m-text">
                      Client ID <span className="text-m-error">*</span>
                    </label>
                    <Input
                      value={oidcClientId}
                      onChange={(e) => setOidcClientId(e.target.value.trim())}
                      placeholder="OIDC application client ID"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-m-text">Client Secret</label>
                    <Input
                      type="password"
                      value={oidcClientSecret}
                      onChange={(e) => setOidcClientSecret(e.target.value.trim())}
                      placeholder="••••••••••••"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. SAML Form */}
            {connector.id === "saml" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">
                    IdP Entry Point URL <span className="text-m-error">*</span>
                  </label>
                  <Input
                    value={samlEntryPoint}
                    onChange={(e) => setSamlEntryPoint(e.target.value.trim())}
                    placeholder="https://idp.example.com/sso/saml"
                    className="font-mono text-xs"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-m-text">Entity ID / Issuer</label>
                  <Input
                    value={samlIssuer}
                    onChange={(e) => setSamlIssuer(e.target.value.trim())}
                    placeholder="urn:example:idp"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between p-4 border-t border-m-border/60 bg-m-surface-1">
        <div>
          {isConfigured && connector.isAvailable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="text-m-error hover:bg-m-error-light/50 border-m-error-border"
            >
              Disconnect & Use Native
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {connector.isAvailable ? "Cancel" : "Close"}
          </Button>
          {connector.isAvailable && (
            <Button type="button" variant="primary" size="sm" onClick={handleSave}>
              {isConfigured ? "Save Changes" : "Save & Connect"}
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
