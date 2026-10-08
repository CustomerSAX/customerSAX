"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import {
  Button,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader
} from "@csa/ui";
import {
  ADMIN_CREATE_PROJECT,
  ADMIN_TEST_PROJECT_CREDENTIALS,
  ADMIN_SAVE_PROJECT_TICKETING,
  ADMIN_UPDATE_AI_SETTINGS
} from "@/features/superadmin/api/queries";
import { useCurrentUser } from "@/lib/use-current-user";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (projectKey: string) => void;
}

export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { user } = useCurrentUser();
  const clientId = user?.activeClientId || user?.organization?.id;

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Details
  const [projectKey, setProjectKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [shellMode, setShellMode] = useState<"b2c" | "b2b">("b2c");

  // Step 2 & 3: Commerce Platform
  const [platform, setPlatform] = useState<"commercetools" | "shopify" | "bigcommerce">("commercetools");
  // commercetools
  const [ctApiUrl, setCtApiUrl] = useState("https://api.us-central1.gcp.commercetools.com");
  const [ctAuthUrl, setCtAuthUrl] = useState("https://auth.us-central1.gcp.commercetools.com");
  const [ctClientId, setCtClientId] = useState("");
  const [ctClientSecret, setCtClientSecret] = useState("");
  const [scopes, setScopes] = useState("");

  // shopify
  const [shopifyStoreDomain, setShopifyStoreDomain] = useState("");
  const [shopifyAdminAccessToken, setShopifyAdminAccessToken] = useState("");
  const [shopifyApiVersion, setShopifyApiVersion] = useState("2024-01");

  // bigcommerce
  const [bigcommerceStoreHash, setBigcommerceStoreHash] = useState("");
  const [bigcommerceClientId, setBigcommerceClientId] = useState("");
  const [bigcommerceAccessToken, setBigcommerceAccessToken] = useState("");

  // Test Connection
  const [testCredentials] = useMutation(ADMIN_TEST_PROJECT_CREDENTIALS);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Step 4: Optional Connectors
  const [ticketingProvider, setTicketingProvider] = useState<"internal" | "zendesk" | "freshdesk">("internal");
  const [zendeskSubdomain, setZendeskSubdomain] = useState("");
  const [zendeskClientId, setZendeskClientId] = useState("");
  const [zendeskClientSecret, setZendeskClientSecret] = useState("");
  const [freshdeskDomain, setFreshdeskDomain] = useState("");
  const [freshdeskApiKey, setFreshdeskApiKey] = useState("");

  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic">("openai");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [aiApiKey, setAiApiKey] = useState("");

  // Submission
  const [createProject] = useMutation(ADMIN_CREATE_PROJECT);
  const [saveTicketing] = useMutation(ADMIN_SAVE_PROJECT_TICKETING);
  const [updateAi] = useMutation(ADMIN_UPDATE_AI_SETTINGS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data } = await testCredentials({
        variables: {
          input: {
            platform,
            projectKey: projectKey.trim(),
            ctAuthUrl: ctAuthUrl.trim(),
            ctClientId: ctClientId.trim(),
            ctClientSecret: ctClientSecret.trim(),
            scopes: scopes.trim() || undefined,
            shopifyStoreDomain: shopifyStoreDomain.trim(),
            shopifyAdminAccessToken: shopifyAdminAccessToken.trim(),
            shopifyApiVersion,
            bigcommerceStoreHash: bigcommerceStoreHash.trim(),
            bigcommerceClientId: bigcommerceClientId.trim(),
            bigcommerceAccessToken: bigcommerceAccessToken.trim()
          }
        }
      });
      const res = data?.adminTestProjectCredentials;
      setTestResult({
        ok: Boolean(res?.ok),
        message: res?.message || (res?.ok ? "Connection verified successfully!" : "Connection failed.")
      });
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!clientId) {
      setErrorMsg("Missing organization identifier. Please re-authenticate.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const cleanProjKey = projectKey.trim().toLowerCase();
      const inputPayload =
        platform === "shopify"
          ? {
              platform: "shopify",
              projectKey: cleanProjKey,
              displayName: displayName.trim() || cleanProjKey,
              shopifyStoreDomain: shopifyStoreDomain.trim(),
              shopifyAdminAccessToken: shopifyAdminAccessToken.trim(),
              shopifyApiVersion,
              standaloneB2cEnabled: shellMode === "b2c",
              standaloneB2bEnabled: shellMode === "b2b"
            }
          : platform === "bigcommerce"
            ? {
                platform: "bigcommerce",
                projectKey: cleanProjKey,
                displayName: displayName.trim() || cleanProjKey,
                bigcommerceStoreHash: bigcommerceStoreHash.trim(),
                bigcommerceClientId: bigcommerceClientId.trim(),
                bigcommerceAccessToken: bigcommerceAccessToken.trim(),
                standaloneB2cEnabled: shellMode === "b2c",
                standaloneB2bEnabled: shellMode === "b2b"
              }
            : {
                platform: "commercetools",
                projectKey: cleanProjKey,
                displayName: displayName.trim() || cleanProjKey,
                ctApiUrl: ctApiUrl.trim(),
                ctAuthUrl: ctAuthUrl.trim(),
                ctClientId: ctClientId.trim(),
                ctClientSecret: ctClientSecret.trim(),
                scopes: scopes.trim() || undefined,
                standaloneB2cEnabled: shellMode === "b2c",
                standaloneB2bEnabled: shellMode === "b2b"
              };

      const res = await createProject({
        variables: {
          clientId,
          input: inputPayload,
          createdBy: user?.email || "admin"
        }
      });

      const newProjectId = res.data?.adminCreateProject?.id;

      // Save ticketing if non-native
      if (newProjectId && ticketingProvider !== "internal") {
        try {
          await saveTicketing({
            variables: {
              clientId,
              id: newProjectId,
              input: {
                provider: ticketingProvider,
                subdomain: zendeskSubdomain.trim() || undefined,
                clientId: zendeskClientId.trim() || undefined,
                clientSecret: zendeskClientSecret.trim() || undefined,
                freshdeskDomain: freshdeskDomain.trim() || undefined,
                freshdeskApiKey: freshdeskApiKey.trim() || undefined
              }
            }
          });
        } catch {
          // ignore
        }
      }

      // Save AI if configured
      if (aiEnabled && aiApiKey.trim()) {
        try {
          await updateAi({
            variables: {
              clientId,
              input: {
                enabled: true,
                provider: aiProvider,
                displayName: "CSA Assistant",
                model: aiModel,
                apiKey: aiApiKey.trim()
              }
            }
          });
        } catch {
          // ignore
        }
      }

      // Select active project on session
      try {
        await fetch("/api/auth/project", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectKey: cleanProjKey, clientId })
        });
      } catch {
        // ignore
      }

      if (onSuccess) {
        onSuccess(cleanProjKey);
      } else {
        window.location.reload();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader title="Create Commerce Project" onClose={onClose} />
      <ModalBody>
        {/* Stepper Bar */}
        <div className="mb-6 grid grid-cols-5 gap-2 border-b border-m-border pb-3">
          {[
            { num: 1, label: "Details" },
            { num: 2, label: "Platform" },
            { num: 3, label: "Credentials" },
            { num: 4, label: "Connectors" },
            { num: 5, label: "Review" }
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 text-xs font-bold ${
                currentStep === s.num
                  ? "text-m-primary"
                  : currentStep > s.num
                    ? "text-m-success"
                    : "text-m-text-muted"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                  currentStep === s.num
                    ? "bg-m-primary text-white"
                    : currentStep > s.num
                      ? "bg-m-success text-white"
                      : "bg-m-neutral-200 text-m-text-muted"
                }`}
              >
                {currentStep > s.num ? "✓" : s.num}
              </span>
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-m-lg border border-m-error-200 bg-m-error-50 p-3 text-xs text-m-error flex items-start gap-2">
            <Icon name="alert-triangle" size="xs" className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-m-text mb-1">Project Key *</label>
              <input
                type="text"
                placeholder="e.g. acme-us-store"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
              />
              <span className="text-[10px] text-m-text-muted mt-1 block">Unique identifier matching your commerce engine</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-m-text mb-1">Display Name *</label>
              <input
                type="text"
                placeholder="Acme US Storefront"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-m-text mb-1">Shell Experience Mode</label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setShellMode("b2c")}
                  className={`flex flex-col items-start p-3 rounded-m-lg border text-left transition-all ${
                    shellMode === "b2c"
                      ? "border-m-primary bg-m-primary-50 text-m-primary"
                      : "border-m-border bg-m-surface text-m-text"
                  }`}
                >
                  <span className="text-xs font-bold">B2C Retail Shell</span>
                  <span className="text-[10px] text-m-text-muted mt-0.5">Consumer orders, carts, and customer profiles</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShellMode("b2b")}
                  className={`flex flex-col items-start p-3 rounded-m-lg border text-left transition-all ${
                    shellMode === "b2b"
                      ? "border-m-primary bg-m-primary-50 text-m-primary"
                      : "border-m-border bg-m-surface text-m-text"
                  }`}
                >
                  <span className="text-xs font-bold">B2B Wholesale Shell</span>
                  <span className="text-[10px] text-m-text-muted mt-0.5">Business units, quotes, approvals, and contract carts</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Select Commerce Platform */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <label className="block text-xs font-bold text-m-text mb-1">Select Commerce Engine</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "commercetools", name: "commercetools", desc: "Composable commerce GraphQL API" },
                { id: "shopify", name: "Shopify", desc: "Admin REST & GraphQL integration" },
                { id: "bigcommerce", name: "BigCommerce", desc: "Store hash & V3 catalog integration" }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id as any)}
                  className={`flex flex-col items-start p-3 rounded-m-lg border text-left transition-all ${
                    platform === p.id
                      ? "border-m-primary bg-m-primary-50 text-m-primary shadow-m-sm"
                      : "border-m-border bg-m-surface text-m-text hover:border-m-border-strong"
                  }`}
                >
                  <span className="text-xs font-bold">{p.name}</span>
                  <span className="text-[10px] text-m-text-muted mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Configure Platform Credentials */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {platform === "commercetools" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">API URL *</label>
                    <input
                      type="text"
                      value={ctApiUrl}
                      onChange={(e) => setCtApiUrl(e.target.value)}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Auth URL *</label>
                    <input
                      type="text"
                      value={ctAuthUrl}
                      onChange={(e) => setCtAuthUrl(e.target.value)}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Client ID *</label>
                    <input
                      type="text"
                      value={ctClientId}
                      onChange={(e) => setCtClientId(e.target.value)}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Client Secret *</label>
                    <input
                      type="password"
                      value={ctClientSecret}
                      onChange={(e) => setCtClientSecret(e.target.value)}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">Scopes (Optional)</label>
                  <input
                    type="text"
                    placeholder="manage_project:acme-store"
                    value={scopes}
                    onChange={(e) => setScopes(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                  />
                </div>
              </div>
            )}

            {platform === "shopify" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">Store Domain *</label>
                  <input
                    type="text"
                    placeholder="acme-store.myshopify.com"
                    value={shopifyStoreDomain}
                    onChange={(e) => setShopifyStoreDomain(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">Admin Access Token *</label>
                  <input
                    type="password"
                    placeholder="shpat_••••••••"
                    value={shopifyAdminAccessToken}
                    onChange={(e) => setShopifyAdminAccessToken(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">API Version</label>
                  <input
                    type="text"
                    placeholder="2024-01"
                    value={shopifyApiVersion}
                    onChange={(e) => setShopifyApiVersion(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                  />
                </div>
              </div>
            )}

            {platform === "bigcommerce" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">Store Hash *</label>
                  <input
                    type="text"
                    value={bigcommerceStoreHash}
                    onChange={(e) => setBigcommerceStoreHash(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Client ID *</label>
                    <input
                      type="text"
                      value={bigcommerceClientId}
                      onChange={(e) => setBigcommerceClientId(e.target.value)}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-m-text mb-1">Access Token *</label>
                    <input
                      type="password"
                      value={bigcommerceAccessToken}
                      onChange={(e) => setBigcommerceAccessToken(e.target.value)}
                      className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="pt-2 flex items-center justify-between border-t border-m-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleTestConnection()}
                disabled={isTesting || (platform === "commercetools" && (!ctClientId || !ctClientSecret))}
                loading={isTesting}
                leftIcon={<Icon name="zap" size="xs" />}
              >
                {isTesting ? "Testing Connection..." : "Test Connection"}
              </Button>

              {testResult && (
                <div
                  className={`text-xs font-medium flex items-center gap-1.5 ${
                    testResult.ok ? "text-m-success" : "text-m-error"
                  }`}
                >
                  <Icon name={testResult.ok ? "check-circle-2" : "alert-triangle"} size="xs" />
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Optional Connectors */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-m-text uppercase tracking-wider text-m-text-muted">
                Ticketing Connector (Optional)
              </h3>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { id: "internal", label: "Native CSA Tickets" },
                  { id: "zendesk", label: "Zendesk Support" },
                  { id: "freshdesk", label: "Freshdesk" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTicketingProvider(t.id as any)}
                    className={`p-2.5 rounded border text-xs font-bold text-left transition-all ${
                      ticketingProvider === t.id
                        ? "border-m-primary bg-m-primary-50 text-m-primary"
                        : "border-m-border bg-m-surface text-m-text"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {ticketingProvider === "zendesk" && (
                <div className="mt-3 space-y-2 p-3 bg-m-neutral-50 rounded border border-m-border text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-m-text mb-0.5">Zendesk Subdomain</label>
                    <input
                      type="text"
                      placeholder="e.g. acmesupport"
                      value={zendeskSubdomain}
                      onChange={(e) => setZendeskSubdomain(e.target.value)}
                      className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-m-text mb-0.5">Client ID</label>
                    <input
                      type="text"
                      value={zendeskClientId}
                      onChange={(e) => setZendeskClientId(e.target.value)}
                      className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-m-text mb-0.5">Client Secret</label>
                    <input
                      type="password"
                      value={zendeskClientSecret}
                      onChange={(e) => setZendeskClientSecret(e.target.value)}
                      className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                </div>
              )}

              {ticketingProvider === "freshdesk" && (
                <div className="mt-3 space-y-2 p-3 bg-m-neutral-50 rounded border border-m-border text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-m-text mb-0.5">Freshdesk Domain</label>
                    <input
                      type="text"
                      placeholder="e.g. acme.freshdesk.com"
                      value={freshdeskDomain}
                      onChange={(e) => setFreshdeskDomain(e.target.value)}
                      className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-m-text mb-0.5">API Key</label>
                    <input
                      type="password"
                      value={freshdeskApiKey}
                      onChange={(e) => setFreshdeskApiKey(e.target.value)}
                      className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-m-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-m-text uppercase tracking-wider text-m-text-muted">
                  AI Assistant (Optional)
                </span>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-m-primary border-m-border"
                  />
                  <span>Enable LLM Assistant</span>
                </label>
              </div>

              {aiEnabled && (
                <div className="space-y-2 p-3 bg-m-neutral-50 rounded border border-m-border text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-m-text mb-0.5">Provider</label>
                      <select
                        value={aiProvider}
                        onChange={(e) => setAiProvider(e.target.value as any)}
                        className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs text-m-text outline-none"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-m-text mb-0.5">Model</label>
                      <input
                        type="text"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs text-m-text outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-m-text mb-0.5">API Key</label>
                    <input
                      type="password"
                      placeholder="sk-••••••••"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      className="w-full rounded border border-m-border bg-m-surface px-2.5 py-1.5 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: Review & Complete Setup */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-m-text-muted">Project Key:</span>
                <span className="font-mono font-bold text-m-text">{projectKey}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Display Name:</span>
                <span className="font-bold text-m-text">{displayName || projectKey}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Commerce Engine:</span>
                <span className="capitalize font-semibold text-m-text">{platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Shell Mode:</span>
                <span className="font-mono uppercase">{shellMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Ticketing:</span>
                <span className="capitalize">{ticketingProvider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">AI Assistant:</span>
                <span>{aiEnabled ? `Enabled (${aiProvider})` : "Native / Disabled"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-m-lg border border-m-success-200 bg-m-success-50 p-3 text-xs text-m-success">
              <Icon name="check-circle-2" size="xs" className="shrink-0" />
              <span>
                You are creating this project as an Organization Admin. Access will be granted directly to your account.
              </span>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex w-full items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                disabled={isSubmitting}
                leftIcon={<Icon name="arrow-left" size="xs" />}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>

            {currentStep < 5 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                disabled={
                  (currentStep === 1 && (!projectKey.trim() || !displayName.trim())) ||
                  (currentStep === 3 && platform === "commercetools" && (!ctClientId.trim() || !ctClientSecret.trim())) ||
                  (currentStep === 3 && platform === "shopify" && (!shopifyStoreDomain.trim() || !shopifyAdminAccessToken.trim()))
                }
                rightIcon={<Icon name="arrow-right" size="xs" />}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleCreate()}
                disabled={isSubmitting}
                loading={isSubmitting}
                rightIcon={<Icon name="check" size="xs" />}
              >
                {isSubmitting ? "Creating Project..." : "Complete Setup & Launch"}
              </Button>
            )}
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
