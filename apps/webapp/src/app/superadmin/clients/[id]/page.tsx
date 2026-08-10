"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  PageShell,
  PageHeader,
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Select,
  Checkbox,
  Icon,
  EmptyState,
  LoadingSpinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  RadioGroup,
  Radio
} from "@csa/ui";
import type { CsaClientPublic, ClientSsoProviderKind } from "@/lib/mongo-clients";
import type { CsaProjectPublic, CommercePlatform } from "@/lib/mongo-projects";
import type { CsaSmtpProfilePublic } from "@/lib/mongo-smtp-profiles";
import type { CsaUserPublic } from "@/lib/mongo-users";

/**
 * Client organization detail. Overview (incl. SSO/Federation), Projects,
 * Users, and Email tabs are all real, backed by MongoDB. Users are the
 * exact accounts apps/auth's /login reads (single tenantId + optional
 * projectKey + role per user) — this page doesn't invent a richer
 * multi-project membership model the login flow wouldn't understand.
 */
export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [client, setClient] = useState<CsaClientPublic | null>(null);
  const [projects, setProjects] = useState<CsaProjectPublic[]>([]);
  const [users, setUsers] = useState<CsaUserPublic[]>([]);
  const [smtpProfiles, setSmtpProfiles] = useState<CsaSmtpProfilePublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const fetchClient = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/clients/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load client");
      setClient(data.client);
      setProjects(data.projects ?? []);
      setUsers(data.users ?? []);
      setSmtpProfiles(data.smtpProfiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load client");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return (
      <PageShell maxWidth="lg">
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      </PageShell>
    );
  }

  if (error || !client) {
    return (
      <PageShell maxWidth="lg">
        <EmptyState icon="alert-triangle" title="Couldn't load client" description={error ?? "Not found"} />
        <Link href="/superadmin/clients" className="text-xs text-m-primary hover:underline">
          &larr; Back to clients
        </Link>
      </PageShell>
    );
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "overview", label: "Overview", count: -1 },
    { key: "projects", label: "Projects", count: projects.length },
    { key: "users", label: "Users", count: users.length },
    { key: "email", label: "Email", count: smtpProfiles.length }
  ];

  return (
    <PageShell maxWidth="lg">
      <div className="text-[11px] font-bold uppercase tracking-wider text-m-primary">Client Details</div>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{client.name}</span>
            <ClientStatusBadge status={client.status} />
          </div>
        }
        subtitle={`${client.slug} · ${client.contactEmail}`}
        actions={
          <Link href="/superadmin/clients">
            <Button variant="secondary" size="sm" leftIcon={<Icon name="arrow-left" size="xs" />}>
              All Clients
            </Button>
          </Link>
        }
      />

      {/* Underline tab bar — matches ct-csa-standalone's exactly (plain
          buttons with a 2px bottom-border active indicator, not pills). */}
      <div className="flex border-b border-m-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2.5 text-xs transition-all ${
              tab === t.key
                ? "border-m-primary font-bold text-m-primary"
                : "border-transparent font-medium text-m-text-muted hover:text-m-text"
            }`}
          >
            {t.label}
            {t.count >= 0 && ` (${t.count})`}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {tab === "overview" && <OverviewTab client={client} onUpdated={fetchClient} />}
        {tab === "projects" && (
          <ProjectsTab clientId={id} clientBlocked={client.status === "blocked"} projects={projects} onChanged={fetchClient} />
        )}
        {tab === "users" && (
          <UsersTab clientId={id} clientBlocked={client.status === "blocked"} users={users} projects={projects} onChanged={fetchClient} />
        )}
        {tab === "email" && <EmailTab clientId={id} profiles={smtpProfiles} onChanged={fetchClient} />}
      </div>
    </PageShell>
  );
}

type TabKey = "overview" | "projects" | "users" | "email";

/** Pill status badge matching ct-csa-standalone's StatusBadge exactly. */
function ClientStatusBadge({ status }: { status: "active" | "blocked" }) {
  const blocked = status === "blocked";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
        blocked
          ? "border-m-error-border bg-m-error-light text-m-error"
          : "border-m-success-border bg-m-success-light text-m-success"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${blocked ? "bg-m-error" : "bg-m-success"}`} />
      {status}
    </span>
  );
}

// ─── Overview (client info + SSO/Federation) ───────────────────────────────

function OverviewTab({ client, onUpdated }: { client: CsaClientPublic; onUpdated: () => void }) {
  const [name, setName] = useState(client.name);
  const [contactEmail, setContactEmail] = useState(client.contactEmail);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(client.name);
    setContactEmail(client.contactEmail);
  }, [client]);

  const isDirty = name.trim() !== client.name || contactEmail.trim() !== client.contactEmail;

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/clients/${client.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contactEmail: contactEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus() {
    const nextStatus = client.status === "active" ? "blocked" : "active";
    setIsTogglingStatus(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update status");
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setIsTogglingStatus(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="text-sm font-bold text-m-text">Client Information</div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">Organization name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">Contact email</label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={isSaving} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">Slug (immutable)</label>
            <Input value={client.slug} disabled className="font-mono opacity-70" />
          </div>

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="flex items-center justify-between border-t border-m-border/60 pt-4 mt-1">
            <Button
              variant={client.status === "active" ? "danger" : "primary"}
              size="sm"
              leftIcon={<Icon name={client.status === "active" ? "ban" : "check-circle"} size="xs" />}
              onClick={handleToggleStatus}
              disabled={isTogglingStatus}
            >
              {isTogglingStatus ? "Updating…" : client.status === "active" ? "Block Client" : "Unblock Client"}
            </Button>

            <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SsoFederationCard client={client} onUpdated={onUpdated} />
    </div>
  );
}

function SsoFederationCard({ client, onUpdated }: { client: CsaClientPublic; onUpdated: () => void }) {
  const stored = client.ssoConfig;
  const [provider, setProvider] = useState<ClientSsoProviderKind>(stored.provider);
  const [issuer, setIssuer] = useState(stored.provider === "oidc" ? stored.issuer : "");
  const [oidcClientId, setOidcClientId] = useState(stored.provider === "oidc" ? stored.clientId : "");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [providerDisplayName, setProviderDisplayName] = useState(stored.provider === "oidc" ? stored.providerDisplayName ?? "" : "");
  const [extraScopes, setExtraScopes] = useState(stored.provider === "oidc" ? stored.extraScopes ?? "" : "");
  const [entryPointUrl, setEntryPointUrl] = useState(stored.provider === "saml" ? stored.entryPointUrl : "");
  const [samlIssuer, setSamlIssuer] = useState(stored.provider === "saml" ? stored.issuer : "");
  const [idpCertPem, setIdpCertPem] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/api/sso/oidc/callback` : "/api/sso/oidc/callback";

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      let ssoConfig: unknown;
      if (provider === "none") {
        ssoConfig = { provider: "none" };
      } else if (provider === "oidc") {
        ssoConfig = {
          provider: "oidc",
          issuer: issuer.trim(),
          clientId: oidcClientId.trim(),
          oidcClientSecret: oidcClientSecret.trim() || undefined,
          providerDisplayName: providerDisplayName.trim() || undefined,
          extraScopes: extraScopes.trim() || undefined
        };
      } else {
        ssoConfig = {
          provider: "saml",
          entryPointUrl: entryPointUrl.trim(),
          issuer: samlIssuer.trim(),
          idpCertPem: idpCertPem.trim() || undefined
        };
      }

      const res = await fetch(`/api/superadmin/clients/${client.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ssoConfig })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save SSO configuration");
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save SSO configuration");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div>
          <div className="text-sm font-bold text-m-text">SSO / Federation</div>
          <p className="text-xs text-m-text-muted mt-1">
            Per-tenant identity provider for the lightweight <code className="font-mono">/sign-in</code> flow. Agents choose their
            organisation when they belong to multiple clients. SAML configuration is stored for reference — the runtime SAML login
            flow isn't wired up in this app yet.
          </p>
        </div>

        <div className="rounded-m-md border border-m-border bg-m-surface-2 px-3 py-2">
          <div className="text-[11px] font-semibold text-m-text-2 mb-0.5">OIDC redirect URI (register in your IdP)</div>
          <code className="text-[11px] text-m-text-muted break-all">{redirectUri}</code>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-m-text-2">Federation type</label>
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ClientSsoProviderKind)}
            options={[
              { value: "none", label: "None" },
              { value: "oidc", label: "OpenID Connect (OIDC)" },
              { value: "saml", label: "SAML 2.0 (config only)" }
            ]}
          />
        </div>

        {provider === "oidc" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-m-text-2">Issuer URL</label>
              <Input placeholder="https://login.microsoftonline.com/{tenantId}/v2.0" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Client ID</label>
              <Input value={oidcClientId} onChange={(e) => setOidcClientId(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">
                Client secret {stored.provider === "oidc" && stored.oidcClientSecretSet && <span className="text-m-text-muted font-normal">(set — leave blank to keep)</span>}
              </label>
              <Input type="password" value={oidcClientSecret} onChange={(e) => setOidcClientSecret(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Provider display name</label>
              <Input placeholder="Contoso Azure AD" value={providerDisplayName} onChange={(e) => setProviderDisplayName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Extra scopes</label>
              <Input placeholder="offline_access" value={extraScopes} onChange={(e) => setExtraScopes(e.target.value)} />
            </div>
          </div>
        )}

        {provider === "saml" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-m-text-2">Entry point URL</label>
              <Input value={entryPointUrl} onChange={(e) => setEntryPointUrl(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Issuer / Entity ID</label>
              <Input value={samlIssuer} onChange={(e) => setSamlIssuer(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-m-text-2">
                IdP x509 certificate (PEM) {stored.provider === "saml" && stored.idpCertSet && <span className="text-m-text-muted font-normal">(set — leave blank to keep)</span>}
              </label>
              <textarea
                className="rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs font-mono"
                rows={4}
                value={idpCertPem}
                onChange={(e) => setIdpCertPem(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-m-error">{error}</p>}

        <div className="flex justify-end border-t border-m-border/60 pt-4">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save SSO Configuration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Projects ───────────────────────────────────────────────────────────────

function ProjectsTab({
  clientId,
  clientBlocked,
  projects,
  onChanged
}: {
  clientId: string;
  clientBlocked: boolean;
  projects: CsaProjectPublic[];
  onChanged: () => void;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<CsaProjectPublic | null>(null);
  const [testMessages, setTestMessages] = useState<Record<string, { ok: boolean; message: string } | undefined>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleTest(project: CsaProjectPublic) {
    setTestingId(project.id);
    setTestMessages((prev) => ({ ...prev, [project.id]: undefined }));
    try {
      const res = await fetch(`/api/superadmin/clients/${clientId}/projects/${project.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestMessages((prev) => ({ ...prev, [project.id]: { ok: !!data.ok, message: data.message ?? data.error ?? "Unknown result" } }));
    } catch (e) {
      setTestMessages((prev) => ({ ...prev, [project.id]: { ok: false, message: e instanceof Error ? e.message : "Connection test failed" } }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(project: CsaProjectPublic) {
    const res = await fetch(`/api/superadmin/clients/${clientId}/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-m-text">{projects.length} project{projects.length === 1 ? "" : "s"}</div>
        <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)} disabled={clientBlocked}>
          Add Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon="package" title="No projects yet" description="Register a CommerceTools, Shopify, or BigCommerce project for this client." />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Key</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead>Shell</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <Fragment key={p.id}>
                  <TableRow>
                    <TableCell className="font-mono">{p.projectKey}</TableCell>
                    <TableCell>{p.displayName}</TableCell>
                    <TableCell>
                      <Badge variant="info" appearance="subtle" size="sm">
                        {p.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-m-text-muted">
                      {p.platform === "shopify" ? p.shopifyStoreDomain : p.platform === "bigcommerce" ? p.bigcommerceClientId : p.ctClientId}
                    </TableCell>
                    <TableCell className="font-mono text-m-text-muted">{p.ctClientSecretMasked}</TableCell>
                    <TableCell>
                      <Badge variant="neutral" appearance="outline" size="sm">
                        {p.standaloneB2bEnabled ? "B2B" : "B2C"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                          Manage
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleTest(p)} disabled={testingId === p.id}>
                          {testingId === p.id ? "Testing…" : "Test"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleDelete(p)}>
                          <Icon name="trash-2" size="xs" className="text-m-error" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {testMessages[p.id] && (
                    <TableRow>
                      <TableCell colSpan={7} className={testMessages[p.id]?.ok ? "text-m-success" : "text-m-error"}>
                        {testMessages[p.id]?.message}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ProjectModal
        isOpen={isAddOpen || !!editing}
        onClose={() => {
          setIsAddOpen(false);
          setEditing(null);
        }}
        clientId={clientId}
        existing={editing}
        onSaved={() => {
          setIsAddOpen(false);
          setEditing(null);
          onChanged();
        }}
      />
    </div>
  );
}

function ProjectModal({
  isOpen,
  onClose,
  clientId,
  existing,
  onSaved
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  existing: CsaProjectPublic | null;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [platform, setPlatform] = useState<CommercePlatform>(existing?.platform ?? "commercetools");
  const [projectKey, setProjectKey] = useState(existing?.projectKey ?? "");
  const [displayName, setDisplayName] = useState(existing?.displayName ?? "");
  const [ctApiUrl, setCtApiUrl] = useState(existing?.ctApiUrl ?? "");
  const [ctAuthUrl, setCtAuthUrl] = useState(existing?.ctAuthUrl ?? "");
  const [ctClientId, setCtClientId] = useState(existing?.ctClientId ?? "");
  const [ctClientSecret, setCtClientSecret] = useState("");
  const [scopes, setScopes] = useState(existing?.scopes ?? "");
  const [shopifyStoreDomain, setShopifyStoreDomain] = useState(existing?.shopifyStoreDomain ?? "");
  const [shopifyAdminAccessToken, setShopifyAdminAccessToken] = useState("");
  const [shopifyApiVersion, setShopifyApiVersion] = useState(existing?.shopifyApiVersion ?? "2024-01");
  const [bigcommerceStoreHash, setBigcommerceStoreHash] = useState(existing?.bigcommerceStoreHash ?? "");
  const [bigcommerceClientId, setBigcommerceClientId] = useState(existing?.bigcommerceClientId ?? "");
  const [bigcommerceAccessToken, setBigcommerceAccessToken] = useState("");
  const [shell, setShell] = useState<"b2c" | "b2b">(existing?.standaloneB2bEnabled ? "b2b" : "b2c");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }
    setPlatform(existing?.platform ?? "commercetools");
    setProjectKey(existing?.projectKey ?? "");
    setDisplayName(existing?.displayName ?? "");
    setCtApiUrl(existing?.ctApiUrl ?? "");
    setCtAuthUrl(existing?.ctAuthUrl ?? "");
    setCtClientId(existing?.ctClientId ?? "");
    setCtClientSecret("");
    setScopes(existing?.scopes ?? "");
    setShopifyStoreDomain(existing?.shopifyStoreDomain ?? "");
    setShopifyAdminAccessToken("");
    setShopifyApiVersion(existing?.shopifyApiVersion ?? "2024-01");
    setBigcommerceStoreHash(existing?.bigcommerceStoreHash ?? "");
    setBigcommerceClientId(existing?.bigcommerceClientId ?? "");
    setBigcommerceAccessToken("");
    setShell(existing?.standaloneB2bEnabled ? "b2b" : "b2c");
  }, [isOpen, existing]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const shellFlags = { standaloneB2cEnabled: shell === "b2c", standaloneB2bEnabled: shell === "b2b" };

    try {
      const url = isEdit
        ? `/api/superadmin/clients/${clientId}/projects/${existing!.id}`
        : `/api/superadmin/clients/${clientId}/projects`;

      const body =
        platform === "shopify"
          ? { platform, projectKey, displayName, shopifyStoreDomain, shopifyAdminAccessToken: shopifyAdminAccessToken || undefined, shopifyApiVersion, ...shellFlags }
          : platform === "bigcommerce"
            ? { platform, projectKey, displayName, bigcommerceStoreHash, bigcommerceClientId, bigcommerceAccessToken: bigcommerceAccessToken || undefined, ...shellFlags }
            : { platform, projectKey, displayName, ctApiUrl, ctAuthUrl, ctClientId, ctClientSecret: ctClientSecret || undefined, scopes: scopes || undefined, ...shellFlags };

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save project");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save project");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <Modal.Header title={isEdit ? "Edit Project" : "Add Project"} onClose={onClose} />
        <Modal.Body>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Platform</label>
              <Select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as CommercePlatform)}
                disabled={isEdit}
                options={[
                  { value: "commercetools", label: "CommerceTools" },
                  { value: "shopify", label: "Shopify" },
                  { value: "bigcommerce", label: "BigCommerce" }
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Project key</label>
              <Input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} disabled={isEdit} required />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-m-text-2">Display name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
          </div>

          {platform === "commercetools" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-m-border/60 pt-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-m-text-2">CT API URL</label>
                <Input placeholder="https://api.us-central1.gcp.commercetools.com" value={ctApiUrl} onChange={(e) => setCtApiUrl(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-m-text-2">CT Auth URL</label>
                <Input placeholder="https://auth.us-central1.gcp.commercetools.com" value={ctAuthUrl} onChange={(e) => setCtAuthUrl(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">Client ID</label>
                <Input value={ctClientId} onChange={(e) => setCtClientId(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">
                  Client secret {isEdit && <span className="text-m-text-muted font-normal">(leave blank to keep)</span>}
                </label>
                <Input type="password" value={ctClientSecret} onChange={(e) => setCtClientSecret(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-m-text-2">Scopes (optional)</label>
                <Input placeholder={`manage_project:${projectKey || "..."}`} value={scopes} onChange={(e) => setScopes(e.target.value)} />
              </div>
            </div>
          )}

          {platform === "shopify" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-m-border/60 pt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">Store domain</label>
                <Input placeholder="mystore.myshopify.com" value={shopifyStoreDomain} onChange={(e) => setShopifyStoreDomain(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">API version</label>
                <Input placeholder="2024-01" value={shopifyApiVersion} onChange={(e) => setShopifyApiVersion(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-m-text-2">
                  Admin access token {isEdit && <span className="text-m-text-muted font-normal">(leave blank to keep)</span>}
                </label>
                <Input type="password" value={shopifyAdminAccessToken} onChange={(e) => setShopifyAdminAccessToken(e.target.value)} />
              </div>
            </div>
          )}

          {platform === "bigcommerce" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-m-border/60 pt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">Store hash</label>
                <Input value={bigcommerceStoreHash} onChange={(e) => setBigcommerceStoreHash(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">Client ID</label>
                <Input value={bigcommerceClientId} onChange={(e) => setBigcommerceClientId(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-m-text-2">
                  Access token {isEdit && <span className="text-m-text-muted font-normal">(leave blank to keep)</span>}
                </label>
                <Input type="password" value={bigcommerceAccessToken} onChange={(e) => setBigcommerceAccessToken(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-m-border/60 pt-3">
            <label className="text-xs font-semibold text-m-text-2">Workspace shell</label>
            <RadioGroup value={shell} onChange={(v) => setShell(v as "b2c" | "b2b")} className="flex-row gap-4">
              <Radio value="b2c" label="B2C" />
              <Radio value="b2b" label="B2B" />
            </RadioGroup>
          </div>

          {error && <p className="text-xs text-m-error">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Add Project"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// ─── Users ──────────────────────────────────────────────────────────────────

function UsersTab({
  clientId,
  clientBlocked,
  users,
  projects,
  onChanged
}: {
  clientId: string;
  clientBlocked: boolean;
  users: CsaUserPublic[];
  projects: CsaProjectPublic[];
  onChanged: () => void;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<CsaUserPublic | null>(null);

  async function handleRemove(user: CsaUserPublic) {
    const res = await fetch(`/api/superadmin/clients/${clientId}/users`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: user.id })
    });
    if (res.ok) onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-m-text">{users.length} user{users.length === 1 ? "" : "s"}</div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icon name="plus" size="xs" />}
          onClick={() => setIsAddOpen(true)}
          disabled={clientBlocked}
        >
          Add User
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon="users" title="No users yet" description="Create or assign an admin/agent user for this client." />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="neutral" appearance="outline" size="sm">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-m-text-muted">{u.projectKey || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "success" : "error"} appearance="subtle" size="sm">
                      {u.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                        Manage
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleRemove(u)}>
                        <Icon name="trash-2" size="xs" className="text-m-error" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <UserModal
        isOpen={isAddOpen || !!editing}
        onClose={() => {
          setIsAddOpen(false);
          setEditing(null);
        }}
        clientId={clientId}
        projects={projects}
        existing={editing}
        onSaved={() => {
          setIsAddOpen(false);
          setEditing(null);
          onChanged();
        }}
      />
    </div>
  );
}

function UserModal({
  isOpen,
  onClose,
  clientId,
  projects,
  existing,
  onSaved
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  projects: CsaProjectPublic[];
  existing: CsaUserPublic | null;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [mode, setMode] = useState<"create" | "assign">("create");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("admin");
  const [projectKey, setProjectKey] = useState("");
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode("create");
    setEmail(existing?.email ?? "");
    setFirstName(existing?.firstName ?? "");
    setLastName(existing?.lastName ?? "");
    setPassword("");
    setRole(existing?.role === "agent" ? "agent" : "admin");
    setProjectKey(existing?.projectKey ?? "");
    setActive(existing?.active ?? true);
    setError(null);
  }, [isOpen, existing]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (isEdit) {
        const res = await fetch(`/api/superadmin/clients/${clientId}/users`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: existing!.id,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            password: password || undefined,
            role,
            projectKey: projectKey || null,
            active
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to update user");
      } else if (mode === "create") {
        const res = await fetch(`/api/superadmin/clients/${clientId}/users`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            role,
            projectKey: projectKey || undefined
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to create user");
      } else {
        const res = await fetch(`/api/superadmin/clients/${clientId}/users`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, role, projectKey: projectKey || undefined })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to assign user");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <form onSubmit={handleSubmit}>
        <Modal.Header title={isEdit ? "Manage User" : "Add User"} onClose={onClose} />
        <Modal.Body>
          {!isEdit && (
            <RadioGroup value={mode} onChange={(v) => setMode(v as "create" | "assign")} className="flex-row gap-4">
              <Radio value="create" label="Create new user" />
              <Radio value="assign" label="Assign existing user" />
            </RadioGroup>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} required />
          </div>

          {(mode === "create" || isEdit) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">First name</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-m-text-2">Last name</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}

          {(mode === "create" || isEdit) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">
                Password {isEdit && <span className="text-m-text-muted font-normal">(leave blank to keep current)</span>}
              </label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!isEdit} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-m-border/60 pt-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Role</label>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as "agent" | "admin")}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "agent", label: "Agent" }
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Project (optional)</label>
              <Select
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                options={[{ value: "", label: "No specific project" }, ...projects.map((p) => ({ value: p.projectKey, label: p.projectKey }))]}
              />
            </div>
          </div>

          {isEdit && (
            <Checkbox label="Active (can log in)" checked={active} onChange={(e) => setActive(e.target.checked)} />
          )}

          {error && <p className="text-xs text-m-error">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Save"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// ─── Email / SMTP profiles ──────────────────────────────────────────────────

function EmailTab({ clientId, profiles, onChanged }: { clientId: string; profiles: CsaSmtpProfilePublic[]; onChanged: () => void }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<CsaSmtpProfilePublic | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string | undefined>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleTest(profile: CsaSmtpProfilePublic) {
    setTestingId(profile.id);
    setTestResult((prev) => ({ ...prev, [profile.id]: undefined }));
    try {
      const res = await fetch(`/api/superadmin/clients/${clientId}/smtp-profiles/${profile.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult((prev) => ({ ...prev, [profile.id]: res.ok ? `Sent to ${data.to}` : data.error }));
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [profile.id]: e instanceof Error ? e.message : "Test failed" }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(profile: CsaSmtpProfilePublic) {
    const res = await fetch(`/api/superadmin/clients/${clientId}/smtp-profiles/${profile.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-m-text">
          {profiles.length} SMTP profile{profiles.length === 1 ? "" : "s"}
        </div>
        <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)}>
          Add Profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState icon="mail" title="No SMTP profiles yet" description="Add outbound email settings for this client." />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <Fragment key={p.id}>
                  <TableRow>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-m-text-muted">
                      {p.smtpHost}:{p.smtpPort} {p.smtpSecure ? "(TLS)" : ""}
                    </TableCell>
                    <TableCell>{p.emailFrom}</TableCell>
                    <TableCell>{p.isDefault && <Badge variant="primary" appearance="subtle" size="sm">Default</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                          Manage
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleTest(p)} disabled={testingId === p.id}>
                          {testingId === p.id ? "Sending…" : "Send test"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleDelete(p)}>
                          <Icon name="trash-2" size="xs" className="text-m-error" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {testResult[p.id] && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-m-text-muted">
                        {testResult[p.id]}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <SmtpProfileModal
        isOpen={isAddOpen || !!editing}
        onClose={() => {
          setIsAddOpen(false);
          setEditing(null);
        }}
        clientId={clientId}
        existing={editing}
        onSaved={() => {
          setIsAddOpen(false);
          setEditing(null);
          onChanged();
        }}
      />
    </div>
  );
}

function SmtpProfileModal({
  isOpen,
  onClose,
  clientId,
  existing,
  onSaved
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  existing: CsaSmtpProfilePublic | null;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? "");
  const [smtpHost, setSmtpHost] = useState(existing?.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(existing?.smtpPort ?? 587);
  const [smtpSecure, setSmtpSecure] = useState(existing?.smtpSecure ?? false);
  const [smtpUser, setSmtpUser] = useState(existing?.smtpUser ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [emailFrom, setEmailFrom] = useState(existing?.emailFrom ?? "");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(existing?.name ?? "");
    setSmtpHost(existing?.smtpHost ?? "");
    setSmtpPort(existing?.smtpPort ?? 587);
    setSmtpSecure(existing?.smtpSecure ?? false);
    setSmtpUser(existing?.smtpUser ?? "");
    setSmtpPassword("");
    setEmailFrom(existing?.emailFrom ?? "");
    setIsDefault(existing?.isDefault ?? false);
    setError(null);
  }, [isOpen, existing]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/superadmin/clients/${clientId}/smtp-profiles/${existing!.id}`
        : `/api/superadmin/clients/${clientId}/smtp-profiles`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPassword: smtpPassword || undefined,
          emailFrom,
          isDefault
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save SMTP profile");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save SMTP profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <form onSubmit={handleSubmit}>
        <Modal.Header title={isEdit ? "Edit SMTP Profile" : "Add SMTP Profile"} onClose={onClose} />
        <Modal.Body>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">Label</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Host</label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Port</label>
              <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value) || 587)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">Username</label>
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-m-text-2">
                Password {isEdit && <span className="text-m-text-muted font-normal">(leave blank to keep)</span>}
              </label>
              <Input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} required={!isEdit} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">From header</label>
            <Input placeholder="Support <noreply@example.com>" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} required />
          </div>
          <div className="flex items-center gap-4">
            <Checkbox label="Use TLS (typically port 465)" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
            <Checkbox label="Default profile for this client" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          </div>

          {error && <p className="text-xs text-m-error">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Add Profile"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
