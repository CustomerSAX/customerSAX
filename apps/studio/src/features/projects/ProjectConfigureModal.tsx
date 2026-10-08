"use client";

import { useState, useEffect } from "react";
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
  ADMIN_UPDATE_PROJECT,
  ADMIN_TEST_PROJECT_CREDENTIALS
} from "@/features/superadmin/api/queries";

interface ProjectConfigureModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    projectKey: string;
    displayName?: string | null;
    platform?: string | null;
    ctApiUrl?: string | null;
    ctAuthUrl?: string | null;
    ctClientId?: string | null;
    scopes?: string | null;
    shopifyStoreDomain?: string | null;
    shopifyApiVersion?: string | null;
    bigcommerceStoreHash?: string | null;
    bigcommerceClientId?: string | null;
  } | null;
  onSuccess?: () => void;
}

export function ProjectConfigureModal({
  isOpen,
  onClose,
  project,
  onSuccess
}: ProjectConfigureModalProps) {
  const platform = (project?.platform || "commercetools") as "commercetools" | "shopify" | "bigcommerce";

  // Form states
  const [displayName, setDisplayName] = useState(project?.displayName || "");
  const [ctApiUrl, setCtApiUrl] = useState(project?.ctApiUrl || "https://api.us-central1.gcp.commercetools.com");
  const [ctAuthUrl, setCtAuthUrl] = useState(project?.ctAuthUrl || "https://auth.us-central1.gcp.commercetools.com");
  const [ctClientId, setCtClientId] = useState(project?.ctClientId || "");
  const [ctClientSecret, setCtClientSecret] = useState("");
  const [scopes, setScopes] = useState(project?.scopes || "");

  const [shopifyStoreDomain, setShopifyStoreDomain] = useState(project?.shopifyStoreDomain || "");
  const [shopifyAdminAccessToken, setShopifyAdminAccessToken] = useState("");
  const [shopifyApiVersion, setShopifyApiVersion] = useState(project?.shopifyApiVersion || "2024-01");

  const [bigcommerceStoreHash, setBigcommerceStoreHash] = useState(project?.bigcommerceStoreHash || "");
  const [bigcommerceClientId, setBigcommerceClientId] = useState(project?.bigcommerceClientId || "");
  const [bigcommerceAccessToken, setBigcommerceAccessToken] = useState("");

  useEffect(() => {
    if (project) {
      setDisplayName(project.displayName || "");
      setCtApiUrl(project.ctApiUrl || "https://api.us-central1.gcp.commercetools.com");
      setCtAuthUrl(project.ctAuthUrl || "https://auth.us-central1.gcp.commercetools.com");
      setCtClientId(project.ctClientId || "");
      setCtClientSecret("");
      setScopes(project.scopes || "");
      setShopifyStoreDomain(project.shopifyStoreDomain || "");
      setShopifyAdminAccessToken("");
      setShopifyApiVersion(project.shopifyApiVersion || "2024-01");
      setBigcommerceStoreHash(project.bigcommerceStoreHash || "");
      setBigcommerceClientId(project.bigcommerceClientId || "");
      setBigcommerceAccessToken("");
      setTestResult(null);
      setErrorMsg(null);
    }
  }, [project]);

  const [testCredentials] = useMutation(ADMIN_TEST_PROJECT_CREDENTIALS);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [updateProject] = useMutation(ADMIN_UPDATE_PROJECT);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data } = await testCredentials({
        variables: {
          input: {
            platform,
            projectKey: project.projectKey,
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

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const updatePayload: Record<string, any> = {
        displayName: displayName.trim() || project.displayName || project.projectKey
      };

      if (platform === "shopify") {
        if (shopifyStoreDomain) updatePayload.shopifyStoreDomain = shopifyStoreDomain.trim();
        if (shopifyAdminAccessToken) updatePayload.shopifyAdminAccessToken = shopifyAdminAccessToken.trim();
        if (shopifyApiVersion) updatePayload.shopifyApiVersion = shopifyApiVersion.trim();
      } else if (platform === "bigcommerce") {
        if (bigcommerceStoreHash) updatePayload.bigcommerceStoreHash = bigcommerceStoreHash.trim();
        if (bigcommerceClientId) updatePayload.bigcommerceClientId = bigcommerceClientId.trim();
        if (bigcommerceAccessToken) updatePayload.bigcommerceAccessToken = bigcommerceAccessToken.trim();
      } else {
        if (ctApiUrl) updatePayload.ctApiUrl = ctApiUrl.trim();
        if (ctAuthUrl) updatePayload.ctAuthUrl = ctAuthUrl.trim();
        if (ctClientId) updatePayload.ctClientId = ctClientId.trim();
        if (ctClientSecret) updatePayload.ctClientSecret = ctClientSecret.trim();
        if (scopes) updatePayload.scopes = scopes.trim();
      }

      await updateProject({
        variables: {
          id: project.id,
          input: updatePayload
        }
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader
        title={`Configure Commerce Platform: ${project.displayName || project.projectKey}`}
        onClose={onClose}
      />
      <ModalBody>
        <div className="space-y-4">
          <p className="text-xs text-m-text-muted">
            Enter your commerce platform credentials to complete setup for project <strong className="font-mono text-m-text">{project.projectKey}</strong>.
          </p>

          {errorMsg && (
            <div className="rounded-m-lg border border-m-error-200 bg-m-error-50 p-3 text-xs text-m-error flex items-start gap-2">
              <Icon name="alert-triangle" size="xs" className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-m-text mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
            />
          </div>

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
                    placeholder="Enter new secret"
                    value={ctClientSecret}
                    onChange={(e) => setCtClientSecret(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono text-m-text outline-none focus:border-m-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Scopes</label>
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

          {/* Test connection row */}
          <div className="pt-2 flex items-center justify-between border-t border-m-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleTest()}
              disabled={isTesting}
              loading={isTesting}
              leftIcon={<Icon name="zap" size="xs" />}
            >
              Test Connection
            </Button>
            {testResult && (
              <span className={`text-xs font-medium ${testResult.ok ? "text-m-success" : "text-m-error"}`}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            disabled={isSaving}
            loading={isSaving}
          >
            Save Configuration
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
