"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client";
import { PageShell, PageHeader, Button, Icon, EmptyState, LoadingSpinner } from "@csa/ui";
import {
  ADMIN_CLIENT_QUERY,
  ADMIN_UPDATE_CLIENT,
  ADMIN_SET_CLIENT_STATUS,
  ADMIN_CREATE_PROJECT,
  ADMIN_UPDATE_PROJECT,
  ADMIN_DELETE_PROJECT,
  ADMIN_TEST_PROJECT_CONNECTION,
  ADMIN_TEST_PROJECT_CREDENTIALS,
  ADMIN_CREATE_SMTP_PROFILE,
  ADMIN_UPDATE_SMTP_PROFILE,
  ADMIN_DELETE_SMTP_PROFILE,
  ADMIN_TEST_SMTP_PROFILE,
  ADMIN_CREATE_CLIENT_USER,
  ADMIN_ASSIGN_CLIENT_USER,
  ADMIN_UPDATE_CLIENT_USER,
  ADMIN_REMOVE_USER_FROM_PROJECT,
  ADMIN_REMOVE_USER_FROM_CLIENT
} from "@/features/superadmin/api/queries";

// ─── Types (mirror the apps/admin GraphQL schema) ──────────────────────────

type SsoConfig = {
  provider: "none" | "oidc" | "saml";
  issuer?: string | null;
  clientId?: string | null;
  providerDisplayName?: string | null;
  extraScopes?: string | null;
  authorizeConnection?: string | null;
  oidcClientSecretSet?: boolean | null;
  entryPointUrl?: string | null;
  idpCertSet?: boolean | null;
};

type ClientDetail = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: "active" | "blocked";
  createdAt?: string | null;
  createdBy?: string | null;
  ssoConfig: SsoConfig;
};

type Platform = "commercetools" | "shopify" | "bigcommerce";
type ShellMode = "b2c" | "b2b";

interface ProjectRow {
  id: string;
  clientId: string;
  platform: Platform;
  projectKey: string;
  displayName: string;
  ctApiUrl: string;
  ctAuthUrl: string;
  ctClientId: string;
  ctClientSecretMasked: string;
  scopes?: string | null;
  smtpProfileId?: string | null;
  standaloneB2cEnabled?: boolean | null;
  standaloneB2bEnabled?: boolean | null;
  shopifyStoreDomain?: string | null;
  shopifyApiVersion?: string | null;
  bigcommerceStoreHash?: string | null;
  bigcommerceClientId?: string | null;
  createdAt?: string | null;
}

interface UserProjectEntry {
  projectKey: string;
  role: string;
}

interface UserRow {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  active: boolean;
  clientProjects: UserProjectEntry[];
}

interface SmtpProfileRow {
  id: string;
  clientId: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordMasked: string;
  emailFrom: string;
  isDefault: boolean;
}

type TabKey = "overview" | "projects" | "users" | "email";

function shellModeFromFlags(p: { standaloneB2cEnabled?: boolean | null; standaloneB2bEnabled?: boolean | null }): ShellMode {
  return p.standaloneB2bEnabled === true ? "b2b" : "b2c";
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [tab, setTab] = useState<TabKey>("overview");

  const { data, loading, error, refetch } = useQuery<{
    adminClient: ClientDetail | null;
    adminProjectsByClient: ProjectRow[];
    adminUsersByClient: UserRow[];
    adminSmtpProfilesByClient: SmtpProfileRow[];
  }>(ADMIN_CLIENT_QUERY, { variables: { id }, fetchPolicy: "cache-and-network" });

  if (loading && !data) {
    return (
      <PageShell maxWidth="lg">
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      </PageShell>
    );
  }

  const client = data?.adminClient;

  if (error || !client) {
    return (
      <PageShell maxWidth="lg">
        <EmptyState icon="alert-triangle" title="Couldn't load client" description={error?.message ?? "Not found"} />
        <Link href="/superadmin/clients" className="text-xs text-m-primary hover:underline">
          &larr; Back to clients
        </Link>
      </PageShell>
    );
  }

  const projects = data?.adminProjectsByClient ?? [];
  const users = data?.adminUsersByClient ?? [];
  const smtpProfiles = data?.adminSmtpProfilesByClient ?? [];

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
        {tab === "overview" && (
          <OverviewTab client={client} projectCount={projects.length} userCount={users.length} onUpdated={refetch} />
        )}
        {tab === "projects" && (
          <ProjectsTab clientId={id} clientBlocked={client.status === "blocked"} projects={projects} onChanged={refetch} />
        )}
        {tab === "users" && (
          <UsersTab clientId={id} clientBlocked={client.status === "blocked"} users={users} projects={projects} onChanged={refetch} />
        )}
        {tab === "email" && (
          <EmailTab clientId={id} profiles={smtpProfiles} projects={projects} onChanged={refetch} />
        )}
      </div>
    </PageShell>
  );
}

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

// Shared "card" look for panels — matches ct-csa-standalone's CARD constant.
const CARD_CLASS = "overflow-hidden rounded-m-xl border border-m-border bg-m-surface shadow-m-card";
const PANEL_HEADER_CLASS = "flex items-center justify-between gap-3 border-b border-m-border/60 px-5 py-3.5";
const LABEL_CLASS = "mb-1 block text-xs font-semibold text-m-text";
const INPUT_CLASS =
  "h-9 w-full rounded-m-md border border-m-border bg-m-surface px-3 text-xs text-m-text outline-none focus:border-m-primary";

// ─── Overview (client info + SSO/Federation) ───────────────────────────────

function OverviewTab({
  client,
  projectCount,
  userCount,
  onUpdated
}: {
  client: ClientDetail;
  projectCount: number;
  userCount: number;
  onUpdated: () => void;
}) {
  const [updateClient] = useMutation(ADMIN_UPDATE_CLIENT);
  const [setStatus] = useMutation(ADMIN_SET_CLIENT_STATUS);

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
      await updateClient({ variables: { id: client.id, name: name.trim(), contactEmail: contactEmail.trim() } });
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
      await setStatus({ variables: { id: client.id, status: nextStatus } });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setIsTogglingStatus(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={CARD_CLASS}>
        <div className={PANEL_HEADER_CLASS}>
          <div className="text-sm font-bold text-m-text">Client Information</div>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL_CLASS}>Organisation Name</label>
              <input className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Contact Email</label>
              <input
                type="email"
                className={INPUT_CLASS}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>
              Slug <span className="font-normal text-m-text-subtle">— immutable after creation</span>
            </label>
            <input className={`${INPUT_CLASS} bg-m-neutral-50 font-mono text-m-text-muted`} value={client.slug} disabled />
          </div>

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="mt-1 flex justify-end border-t border-m-border pt-4">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <SsoFederationCard client={client} onUpdated={onUpdated} />

      {/* Access Control — matches ct-csa-standalone's separate "Block / unblock card". */}
      <div className={CARD_CLASS}>
        <div className={PANEL_HEADER_CLASS}>
          <div className="text-sm font-bold text-m-text">Access Control</div>
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <div className="mb-0.5 text-xs font-medium text-m-text">
              Client Status: <ClientStatusBadge status={client.status} />
            </div>
            <p className="mt-1.5 text-xs text-m-text-muted">
              {client.status === "active"
                ? "Blocking prevents new projects and users from being added."
                : "Client is currently blocked. Unblock to allow normal operations."}
            </p>
          </div>
          <Button
            variant={client.status === "active" ? "danger" : "outline"}
            size="sm"
            onClick={handleToggleStatus}
            disabled={isTogglingStatus}
          >
            {isTogglingStatus ? "…" : client.status === "active" ? "Block Client" : "Unblock Client"}
          </Button>
        </div>
      </div>

      {/* Details — matches ct-csa-standalone's "Metadata card". */}
      <div className={CARD_CLASS}>
        <div className={PANEL_HEADER_CLASS}>
          <div className="text-sm font-bold text-m-text">Details</div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          {[
            ["Created by", client.createdBy || "—"],
            ["Created at", client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "—"],
            ["Projects", String(projectCount)],
            ["Users", String(userCount)]
          ].map(([label, value]) => (
            <div key={label}>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-m-text-subtle">{label}</div>
              <div className="text-xs text-m-text">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SsoFederationCard({ client, onUpdated }: { client: ClientDetail; onUpdated: () => void }) {
  const [updateClient] = useMutation(ADMIN_UPDATE_CLIENT);
  const stored = client.ssoConfig;

  const [provider, setProvider] = useState(stored.provider);
  const [issuer, setIssuer] = useState(stored.issuer ?? "");
  const [oidcClientId, setOidcClientId] = useState(stored.clientId ?? "");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [providerDisplayName, setProviderDisplayName] = useState(stored.providerDisplayName ?? "");
  const [extraScopes, setExtraScopes] = useState(stored.extraScopes ?? "");
  const [authorizeConnection, setAuthorizeConnection] = useState(stored.authorizeConnection ?? "");
  const [entryPointUrl, setEntryPointUrl] = useState(stored.entryPointUrl ?? "");
  const [samlIssuer, setSamlIssuer] = useState(stored.provider === "saml" ? (stored.issuer ?? "") : "");
  const [idpCertPem, setIdpCertPem] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/api/sso/oidc/callback` : "/api/sso/oidc/callback";
  const oidcSecretSet = stored.oidcClientSecretSet ?? false;
  const idpCertSet = stored.idpCertSet ?? false;

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      let ssoConfig: Record<string, unknown>;
      if (provider === "none") {
        ssoConfig = { provider: "none" };
      } else if (provider === "oidc") {
        ssoConfig = {
          provider: "oidc",
          issuer: issuer.trim(),
          clientId: oidcClientId.trim(),
          oidcClientSecret: oidcClientSecret.trim() || undefined,
          providerDisplayName: providerDisplayName.trim() || undefined,
          extraScopes: extraScopes.trim() || undefined,
          authorizeConnection: authorizeConnection.trim() || undefined
        };
      } else {
        ssoConfig = {
          provider: "saml",
          entryPointUrl: entryPointUrl.trim(),
          issuer: samlIssuer.trim(),
          idpCertPem: idpCertPem.trim() || undefined
        };
      }

      await updateClient({ variables: { id: client.id, ssoConfig } });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save SSO configuration");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={CARD_CLASS}>
      <div className="border-b border-m-border/60 px-5 py-3.5">
        <div className="text-sm font-bold text-m-text">SSO / Federation</div>
        <p className="mt-1 text-xs text-m-text-muted">
          Per-tenant identity provider for the lightweight <code className="rounded bg-m-neutral-100 px-1.5 py-0.5 text-[11px]">/sign-in</code> flow. Agents choose their organisation when they belong to multiple clients.
        </p>
      </div>
      <div className="flex flex-col gap-3.5 p-5">
        <div className="rounded-m-md border border-m-border bg-m-neutral-50 px-3 py-2">
          <div className="mb-0.5 text-[11px] font-semibold text-m-text-2">OIDC redirect URI (register in your IdP)</div>
          <code className="break-all text-[11px] text-m-text-muted">{redirectUri}</code>
        </div>

        <div>
          <label className={LABEL_CLASS}>Federation type</label>
          <select
            className={`${INPUT_CLASS} cursor-pointer bg-m-surface`}
            value={provider}
            onChange={(e) => setProvider(e.target.value as SsoConfig["provider"])}
          >
            <option value="none">None — password only</option>
            <option value="oidc">OpenID Connect (OAuth 2.0)</option>
            <option value="saml">SAML 2.0 (store metadata; runtime sign-in not wired yet)</option>
          </select>
        </div>

        {provider === "oidc" && (
          <>
            <div>
              <label className={LABEL_CLASS}>
                Issuer URL {!issuer && <span className="text-m-error">*</span>}
              </label>
              <input className={`${INPUT_CLASS} font-mono`} placeholder="https://login.microsoftonline.com/{tenant}/v2.0" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={LABEL_CLASS}>
                  Client ID {!oidcClientId && <span className="text-m-error">*</span>}
                </label>
                <input className={`${INPUT_CLASS} font-mono`} value={oidcClientId} onChange={(e) => setOidcClientId(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  Client secret{" "}
                  {oidcSecretSet ? (
                    <span className="font-normal text-m-text-muted">— leave blank to keep</span>
                  ) : (
                    <span className="text-m-error">*</span>
                  )}
                </label>
                <input
                  type="password"
                  className={`${INPUT_CLASS} font-mono`}
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                  autoComplete="new-password"
                  placeholder={oidcSecretSet ? "••••••••" : ""}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Button label <span className="font-normal text-m-text-subtle">— optional</span>
              </label>
              <input className={INPUT_CLASS} placeholder="e.g. Sign in with Azure AD" value={providerDisplayName} onChange={(e) => setProviderDisplayName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Extra scopes <span className="font-normal text-m-text-subtle">— optional, space-separated</span>
              </label>
              <input className={INPUT_CLASS} placeholder="e.g. Groups.Claim" value={extraScopes} onChange={(e) => setExtraScopes(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                OAuth connection <span className="font-normal text-m-text-subtle">— optional</span>
              </label>
              <input
                className={`${INPUT_CLASS} font-mono`}
                placeholder="e.g. Username-Password-Authentication"
                value={authorizeConnection}
                onChange={(e) => setAuthorizeConnection(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-m-text-muted">
                Sends the standard <code className="text-[10px]">connection</code> authorize parameter. For{" "}
                <strong className="font-semibold">Auth0</strong>, enter your <em>Connections → Database → connection name</em>{" "}
                (often <code className="text-[10px]">Username-Password-Authentication</code>). Enable this connection for your
                SPA application. Combined with Organisation sign-in, this improves the hand-off together with{" "}
                <code className="text-[10px]">login_hint</code>. Whether the email field is editable and which input is
                focused are controlled entirely by your IdP&apos;s Universal Login branding — not by this application.
              </p>
            </div>
          </>
        )}

        {provider === "saml" && (
          <>
            <p className="rounded-m-md border border-m-warning-border bg-m-warning-light px-3 py-2.5 text-xs text-m-warning-dark">
              SAML metadata is saved for your records. Interactive SAML login from /sign-in is not implemented in this
              build — use OIDC where possible.
            </p>
            <div>
              <label className={LABEL_CLASS}>
                IdP SSO URL {!entryPointUrl && <span className="text-m-error">*</span>}
              </label>
              <input className={INPUT_CLASS} placeholder="https://idp.example.com/app/xxx/sso/saml" value={entryPointUrl} onChange={(e) => setEntryPointUrl(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                IdP issuer / entity ID {!samlIssuer && <span className="text-m-error">*</span>}
              </label>
              <input className={INPUT_CLASS} value={samlIssuer} onChange={(e) => setSamlIssuer(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                X.509 certificate (PEM){" "}
                {idpCertSet ? (
                  <span className="font-normal text-m-text-muted">— leave blank to keep</span>
                ) : (
                  <span className="text-m-error">*</span>
                )}
              </label>
              <textarea
                className="w-full resize-y rounded-m-md border border-m-border bg-m-surface px-3 py-2 font-mono text-[11px]"
                rows={5}
                placeholder="-----BEGIN CERTIFICATE-----"
                value={idpCertPem}
                onChange={(e) => setIdpCertPem(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="text-xs text-m-error">{error}</p>}

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save SSO settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Shell mode picker (radio, compact/row for tables, full for modals) ───

function ShellModePicker({
  name,
  value,
  onChange,
  compact = false
}: {
  name: string;
  value: ShellMode;
  onChange: (mode: ShellMode) => void;
  compact?: boolean;
}) {
  const options: { mode: ShellMode; label: string; hint: string }[] = [
    { mode: "b2c", label: "B2C shell", hint: "Customers, carts, ticket-style flows" },
    { mode: "b2b", label: "B2B shell", hint: "/b2b routes — rollout per feature" }
  ];

  return (
    <div className={`flex ${compact ? "flex-row gap-3" : "flex-col gap-2.5"}`}>
      {options.map((option) => (
        <label key={option.mode} className={`flex cursor-pointer gap-2 ${compact ? "items-center" : "items-start"}`}>
          <input
            type="radio"
            name={name}
            checked={value === option.mode}
            onChange={() => onChange(option.mode)}
            className="accent-m-primary"
          />
          {compact ? (
            <span className="text-xs font-semibold text-m-text">{option.mode.toUpperCase()}</span>
          ) : (
            <span>
              <span className="block text-xs font-semibold text-m-text">{option.label}</span>
              <span className="block text-[11px] leading-snug text-m-text-muted">{option.hint}</span>
            </span>
          )}
        </label>
      ))}
    </div>
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
  projects: ProjectRow[];
  onChanged: () => void;
}) {
  const [testConnection] = useMutation(ADMIN_TEST_PROJECT_CONNECTION);
  const [deleteProject] = useMutation(ADMIN_DELETE_PROJECT);
  const [updateProject] = useMutation(ADMIN_UPDATE_PROJECT);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string } | undefined>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleTest(project: ProjectRow) {
    setTestingId(project.id);
    try {
      const { data } = await testConnection({ variables: { id: project.id } });
      const result = data?.adminTestProjectConnection;
      setTestResults((prev) => ({ ...prev, [project.id]: result ? { ok: result.ok, message: result.message } : undefined }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [project.id]: { ok: false, message: e instanceof Error ? e.message : "Connection test failed" } }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(project: ProjectRow) {
    setRemovingId(project.id);
    try {
      await deleteProject({ variables: { id: project.id } });
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleShellChange(project: ProjectRow, mode: ShellMode) {
    if (shellModeFromFlags(project) === mode) return;
    await updateProject({
      variables: {
        id: project.id,
        input: { standaloneB2cEnabled: mode === "b2c", standaloneB2bEnabled: mode === "b2b" }
      }
    });
    onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={CARD_CLASS}>
        <div className={PANEL_HEADER_CLASS}>
          <div className="text-sm font-bold text-m-text">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </div>
          <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)} disabled={clientBlocked}>
            Add Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="p-10">
            <EmptyState icon="package" title="No projects yet" description="Register a CommerceTools, Shopify, or BigCommerce project for this client." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-m-border/60 bg-m-neutral-50">
                  {["Project Key", "Display Name", "API Region", "Client ID", "Secret", "Shell", "Added", "Actions"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-m-text-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => (
                  <Fragment key={p.id}>
                    <tr className={idx < projects.length - 1 ? "border-b border-m-border/40" : ""}>
                      <td className="px-4 py-3 font-mono font-semibold">
                        <button type="button" className="text-m-primary underline" onClick={() => setEditing(p)}>
                          {p.projectKey}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {p.displayName}
                        <span className="ml-2 rounded-full border border-m-primary-200 bg-m-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-m-primary">
                          {p.platform === "shopify" ? "Shopify" : p.platform === "bigcommerce" ? "BigCommerce" : "CommerceTools"}
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-m-text-muted" title={p.ctApiUrl}>
                        {p.ctApiUrl?.replace("https://", "") || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-m-text-muted">
                        {p.platform === "shopify" ? p.shopifyStoreDomain : p.platform === "bigcommerce" ? p.bigcommerceClientId : p.ctClientId}
                      </td>
                      <td className="px-4 py-3 font-mono tracking-wider text-m-text-subtle">{p.ctClientSecretMasked}</td>
                      <td className="px-4 py-3">
                        <ShellModePicker name={`shell-${p.id}`} value={shellModeFromFlags(p)} onChange={(mode) => void handleShellChange(p, mode)} compact />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-m-text-muted">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <div className="flex gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void handleTest(p)} disabled={testingId === p.id}>
                              {testingId === p.id ? "Testing…" : "Test"}
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => void handleDelete(p)} disabled={removingId === p.id}>
                              Remove
                            </Button>
                          </div>
                          {testResults[p.id] && (
                            <span className={testResults[p.id]?.ok ? "text-[11px] text-m-success" : "text-[11px] text-m-error"}>
                              {testResults[p.id]?.ok ? "✓ OK" : "✗ Failed"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {testResults[p.id] && !testResults[p.id]?.ok && (
                      <tr>
                        <td colSpan={8} className="bg-m-error-light px-4 py-2 text-[11px] text-m-error">
                          {testResults[p.id]?.message}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
  existing: ProjectRow | null;
  onSaved: () => void;
}) {
  const [createProject] = useMutation(ADMIN_CREATE_PROJECT);
  const [updateProject] = useMutation(ADMIN_UPDATE_PROJECT);
  const [testCredentials] = useMutation(ADMIN_TEST_PROJECT_CREDENTIALS);
  const [testConnection] = useMutation(ADMIN_TEST_PROJECT_CONNECTION);

  const isEdit = !!existing;
  const [platform, setPlatform] = useState<Platform>(existing?.platform ?? "commercetools");
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
  const [shell, setShell] = useState<ShellMode>(existing ? shellModeFromFlags(existing) : "b2c");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setTestResult(null);
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
    setShell(existing ? shellModeFromFlags(existing) : "b2c");
  }, [isOpen, existing]);

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (isEdit && existing) {
        const { data } = await testConnection({ variables: { id: existing.id } });
        if (data?.adminTestProjectConnection) setTestResult(data.adminTestProjectConnection);
      } else {
        const { data } = await testCredentials({
          variables: {
            input: {
              platform,
              projectKey,
              ctAuthUrl,
              ctClientId,
              ctClientSecret: ctClientSecret || undefined,
              scopes: scopes || undefined,
              shopifyStoreDomain,
              shopifyAdminAccessToken: shopifyAdminAccessToken || undefined,
              shopifyApiVersion,
              bigcommerceStoreHash,
              bigcommerceClientId,
              bigcommerceAccessToken: bigcommerceAccessToken || undefined
            }
          }
        });
        if (data?.adminTestProjectCredentials) setTestResult(data.adminTestProjectCredentials);
      }
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Connection test failed" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const shellFlags = { standaloneB2cEnabled: shell === "b2c", standaloneB2bEnabled: shell === "b2b" };

    try {
      if (isEdit && existing) {
        const input =
          platform === "shopify"
            ? { displayName, shopifyStoreDomain, shopifyAdminAccessToken: shopifyAdminAccessToken || undefined, shopifyApiVersion, ...shellFlags }
            : platform === "bigcommerce"
              ? { displayName, bigcommerceStoreHash, bigcommerceClientId, bigcommerceAccessToken: bigcommerceAccessToken || undefined, ...shellFlags }
              : { displayName, ctApiUrl, ctAuthUrl, ctClientId, ctClientSecret: ctClientSecret || undefined, scopes: scopes || undefined, ...shellFlags };
        await updateProject({ variables: { id: existing.id, input } });
      } else {
        const input =
          platform === "shopify"
            ? { platform, projectKey, displayName, shopifyStoreDomain, shopifyAdminAccessToken, shopifyApiVersion, ...shellFlags }
            : platform === "bigcommerce"
              ? { platform, projectKey, displayName, bigcommerceStoreHash, bigcommerceClientId, bigcommerceAccessToken, ...shellFlags }
              : { platform, projectKey, displayName, ctApiUrl, ctAuthUrl, ctClientId, ctClientSecret, scopes: scopes || undefined, ...shellFlags };
        await createProject({ variables: { clientId, input, createdBy: "superadmin" } });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save project");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-m-neutral-950/45 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-m-xl bg-m-surface p-7 shadow-m-modal">
        <h2 className="mb-1 text-base font-bold text-m-primary">{isEdit ? "Edit Project" : "Add Project"}</h2>
        <p className="mb-5 text-xs text-m-text-muted">Connect a commerce project to this client. Credentials are encrypted at rest.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className={LABEL_CLASS}>Commerce Platform *</label>
            <select
              className={`${INPUT_CLASS} cursor-pointer bg-m-surface`}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              disabled={isEdit}
            >
              <option value="commercetools">CommerceTools</option>
              <option value="shopify">Shopify</option>
              <option value="bigcommerce">BigCommerce</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Project Key *</label>
              <input className={`${INPUT_CLASS} font-mono`} value={projectKey} onChange={(e) => setProjectKey(e.target.value)} disabled={isEdit} required />
            </div>
            <div>
              <label className={LABEL_CLASS}>Display Name *</label>
              <input className={INPUT_CLASS} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
          </div>

          {platform === "commercetools" && (
            <>
              <div>
                <label className={LABEL_CLASS}>CT API URL *</label>
                <input className={INPUT_CLASS} placeholder="https://api.us-central1.gcp.commercetools.com" value={ctApiUrl} onChange={(e) => setCtApiUrl(e.target.value)} required />
              </div>
              <div>
                <label className={LABEL_CLASS}>CT Auth URL *</label>
                <input className={INPUT_CLASS} placeholder="https://auth.us-central1.gcp.commercetools.com" value={ctAuthUrl} onChange={(e) => setCtAuthUrl(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Client ID *</label>
                  <input className={`${INPUT_CLASS} font-mono`} value={ctClientId} onChange={(e) => setCtClientId(e.target.value)} required />
                </div>
                <div>
                  <label className={LABEL_CLASS}>
                    Client Secret * {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
                  </label>
                  <input type="password" className={`${INPUT_CLASS} font-mono`} value={ctClientSecret} onChange={(e) => setCtClientSecret(e.target.value)} required={!isEdit} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Scopes — optional, defaults to manage_project:&lt;key&gt;</label>
                <input className={INPUT_CLASS} value={scopes} onChange={(e) => setScopes(e.target.value)} />
              </div>
            </>
          )}

          {platform === "shopify" && (
            <>
              <div>
                <label className={LABEL_CLASS}>Store Domain *</label>
                <input className={`${INPUT_CLASS} font-mono`} placeholder="my-store.myshopify.com" value={shopifyStoreDomain} onChange={(e) => setShopifyStoreDomain(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>
                    Admin API Token * {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
                  </label>
                  <input type="password" className={`${INPUT_CLASS} font-mono`} placeholder="shpat_..." value={shopifyAdminAccessToken} onChange={(e) => setShopifyAdminAccessToken(e.target.value)} required={!isEdit} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>API Version *</label>
                  <input className={`${INPUT_CLASS} font-mono`} placeholder="2024-10" value={shopifyApiVersion} onChange={(e) => setShopifyApiVersion(e.target.value)} required />
                </div>
              </div>
            </>
          )}

          {platform === "bigcommerce" && (
            <>
              <div>
                <label className={LABEL_CLASS}>Store Hash *</label>
                <input className={`${INPUT_CLASS} font-mono`} value={bigcommerceStoreHash} onChange={(e) => setBigcommerceStoreHash(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Client ID *</label>
                  <input className={`${INPUT_CLASS} font-mono`} value={bigcommerceClientId} onChange={(e) => setBigcommerceClientId(e.target.value)} required />
                </div>
                <div>
                  <label className={LABEL_CLASS}>
                    Access Token * {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
                  </label>
                  <input type="password" className={`${INPUT_CLASS} font-mono`} value={bigcommerceAccessToken} onChange={(e) => setBigcommerceAccessToken(e.target.value)} required={!isEdit} />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2.5 rounded-m-md border border-m-border bg-m-neutral-50 p-3">
            <span className="text-xs font-semibold text-m-text-2">CSA Standalone shell (tenant-level)</span>
            <ShellModePicker name="project-shell" value={shell} onChange={setShell} />
            <span className="text-[11px] leading-snug text-m-text-muted">
              Each project uses either the B2C or B2B shell (superadmin). Users with project access see pages allowed by their role.
            </span>
          </div>

          {testResult && (
            <div className={`rounded-m-md border px-3 py-2 text-xs ${testResult.ok ? "border-m-success-border bg-m-success-light text-m-success" : "border-m-error-border bg-m-error-light text-m-error"}`}>
              {testResult.ok ? "✓ " : "✗ "}
              {testResult.message}
            </div>
          )}

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => void handleTest()} disabled={isTesting}>
              {isTesting ? "Testing…" : "Test Connection"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Add Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
  users: UserRow[];
  projects: ProjectRow[];
  onChanged: () => void;
}) {
  const [removeFromProject] = useMutation(ADMIN_REMOVE_USER_FROM_PROJECT);
  const [removeFromClient] = useMutation(ADMIN_REMOVE_USER_FROM_CLIENT);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  async function handleRemoveFromProject(email: string, projectKey: string) {
    setRemovingEmail(email);
    try {
      await removeFromProject({ variables: { clientId, email, projectKey } });
      onChanged();
    } finally {
      setRemovingEmail(null);
    }
  }

  async function handleRemoveAll(email: string) {
    setRemovingEmail(email);
    try {
      await removeFromClient({ variables: { clientId, email } });
      onChanged();
    } finally {
      setRemovingEmail(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={CARD_CLASS}>
        <div className={PANEL_HEADER_CLASS}>
          <div className="text-sm font-bold text-m-text">
            {users.length} user{users.length === 1 ? "" : "s"}
          </div>
          <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)} disabled={clientBlocked}>
            Add User
          </Button>
        </div>

        {users.length === 0 ? (
          <div className="p-10">
            <EmptyState icon="users" title="No users yet" description="Assign a user to a project in this client." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-m-border/60 bg-m-neutral-50">
                  {["Email", "Name", "Projects", "Actions"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-m-text-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u.email} className={`align-top ${idx < users.length - 1 ? "border-b border-m-border/40" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{u.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-m-text-muted">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.clientProjects.length === 0 ? (
                          <span className="text-m-text-subtle">—</span>
                        ) : (
                          u.clientProjects.map((p) => (
                            <span
                              key={p.projectKey}
                              className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold ${
                                p.role === "admin" ? "bg-m-primary-50 text-m-primary" : "bg-m-info-light text-m-info-dark"
                              }`}
                            >
                              {p.projectKey}
                              <span className="text-[10px] opacity-70">({p.role})</span>
                              <button
                                type="button"
                                title={`Remove from ${p.projectKey}`}
                                disabled={removingEmail === u.email}
                                onClick={() => void handleRemoveFromProject(u.email, p.projectKey)}
                                className="pl-0.5 text-sm leading-none opacity-70 hover:opacity-100 disabled:opacity-30"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={removingEmail === u.email}
                          title="Remove from all projects in this client"
                          onClick={() => void handleRemoveAll(u.email)}
                        >
                          Remove All
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-m-border/60 bg-m-info-light/40 px-5 py-3">
          <p className="text-[11px] text-m-info-dark">
            <strong>Note:</strong> Removing a user from this client does not delete their account. They can still log
            in but will no longer be associated with this client. Role changes take effect on next sign-in.
          </p>
        </div>
      </div>

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
  projects: ProjectRow[];
  existing: UserRow | null;
  onSaved: () => void;
}) {
  const [createUser] = useMutation(ADMIN_CREATE_CLIENT_USER);
  const [assignUser] = useMutation(ADMIN_ASSIGN_CLIENT_USER);
  const [updateUser] = useMutation(ADMIN_UPDATE_CLIENT_USER);

  const isEdit = !!existing;
  const [mode, setMode] = useState<"create" | "assign">("create");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  // create/assign: single role applied to every checked project
  const [bulkRole, setBulkRole] = useState("admin");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  // edit: per-project role
  const [editRoles, setEditRoles] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode("create");
    setEmail(existing?.email ?? "");
    setFirstName(existing?.firstName ?? "");
    setLastName(existing?.lastName ?? "");
    setPassword("");
    setBulkRole("admin");
    setSelectedKeys(existing ? existing.clientProjects.map((p) => p.projectKey) : []);
    const roles: Record<string, string> = {};
    for (const p of existing?.clientProjects ?? []) roles[p.projectKey] = p.role;
    setEditRoles(roles);
    setError(null);
  }, [isOpen, existing]);

  function toggleProject(projectKey: string) {
    setSelectedKeys((prev) => (prev.includes(projectKey) ? prev.filter((k) => k !== projectKey) : [...prev, projectKey]));
    setEditRoles((prev) => (prev[projectKey] ? prev : { ...prev, [projectKey]: "admin" }));
  }

  const isFormValid = isEdit
    ? true
    : mode === "assign"
      ? email.length > 0 && selectedKeys.length > 0
      : email.length > 0 && password.length >= 8;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (isEdit && existing) {
        const projectsPayload = selectedKeys.map((projectKey) => ({ projectKey, role: editRoles[projectKey] ?? "admin" }));
        await updateUser({
          variables: {
            clientId,
            grantedBy: "superadmin",
            input: { email: existing.email, firstName, lastName, password: password.trim() || undefined, projects: projectsPayload }
          }
        });
      } else if (mode === "create") {
        const projectsPayload = selectedKeys.map((projectKey) => ({ projectKey, role: bulkRole }));
        await createUser({
          variables: {
            clientId,
            grantedBy: "superadmin",
            input: { email, password, firstName: firstName || undefined, lastName: lastName || undefined, projects: projectsPayload }
          }
        });
      } else {
        const projectsPayload = selectedKeys.map((projectKey) => ({ projectKey, role: bulkRole }));
        await assignUser({ variables: { clientId, grantedBy: "superadmin", input: { email, projects: projectsPayload } } });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-m-neutral-950/45 p-4">
      <div className="w-full max-w-lg overflow-y-auto rounded-m-xl bg-m-surface p-7 shadow-m-modal" style={{ maxHeight: "90vh" }}>
        <h2 className="mb-4 text-base font-bold text-m-primary">{isEdit ? "Edit User" : "Add User to Client"}</h2>

        {!isEdit && (
          <div className="mb-5 flex gap-2 rounded-m-md bg-m-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 rounded-m-sm py-2 text-xs font-semibold transition-all ${mode === "create" ? "bg-m-surface text-m-primary shadow-m-xs" : "text-m-text-muted"}`}
            >
              Create New User
            </button>
            <button
              type="button"
              onClick={() => setMode("assign")}
              className={`flex-1 rounded-m-sm py-2 text-xs font-semibold transition-all ${mode === "assign" ? "bg-m-surface text-m-primary shadow-m-xs" : "text-m-text-muted"}`}
            >
              Assign Existing User
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className={LABEL_CLASS}>Email *</label>
            <input type="email" className={INPUT_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} required />
          </div>

          {(mode === "create" || isEdit) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>First Name</label>
                <input className={INPUT_CLASS} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Last Name</label>
                <input className={INPUT_CLASS} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}

          {(mode === "create" || isEdit) && (
            <div>
              <label className={LABEL_CLASS}>
                {isEdit ? "New Password" : "Password *"}{" "}
                <span className="font-normal text-m-text-subtle">{isEdit ? "(leave blank to keep current)" : "(min 8 chars)"}</span>
              </label>
              <input type="password" className={INPUT_CLASS} value={password} onChange={(e) => setPassword(e.target.value)} required={!isEdit} />
            </div>
          )}

          <div>
            <label className={LABEL_CLASS}>{isEdit ? "Project Assignments" : "Assign to Projects"}</label>
            {projects.length === 0 ? (
              <div className="rounded-m-md border border-m-error-border bg-m-error-light px-3 py-2.5 text-xs text-m-error">
                This client has no projects yet. Add a project first.
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-m-md border border-m-border">
                {projects.map((p, idx) => {
                  const checked = selectedKeys.includes(p.projectKey);
                  return (
                    <div
                      key={p.projectKey}
                      className={`flex items-center gap-2.5 px-3 py-2 ${idx < projects.length - 1 ? "border-b border-m-border/50" : ""} ${checked ? "bg-m-primary-50" : ""}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleProject(p.projectKey)} className="h-3.5 w-3.5 accent-m-primary" />
                      <div className="flex-1 cursor-pointer" onClick={() => toggleProject(p.projectKey)}>
                        <div className="text-xs font-medium text-m-text">{p.projectKey}</div>
                        {p.displayName && <div className="text-[11px] text-m-text-muted">{p.displayName}</div>}
                      </div>
                      {isEdit && (
                        <select
                          value={editRoles[p.projectKey] ?? "admin"}
                          disabled={!checked}
                          onChange={(e) => setEditRoles((prev) => ({ ...prev, [p.projectKey]: e.target.value }))}
                          className="rounded-m-sm border border-m-border bg-m-surface px-2 py-1 text-[11px] disabled:bg-m-neutral-100 disabled:text-m-text-subtle"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!isEdit && (
            <div>
              <label className={LABEL_CLASS}>Role for selected Projects</label>
              <select className={`${INPUT_CLASS} cursor-pointer bg-m-surface`} value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
                <option value="admin">Admin — full access, user management</option>
                <option value="member">Member — view-only access</option>
              </select>
            </div>
          )}

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving || !isFormValid}>
              {isSaving ? (isEdit ? "Saving…" : mode === "assign" ? "Assigning…" : "Creating…") : isEdit ? "Save Changes" : mode === "assign" ? "Assign User" : "Create User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Email / SMTP profiles ──────────────────────────────────────────────────

function EmailTab({
  clientId,
  profiles,
  projects,
  onChanged
}: {
  clientId: string;
  profiles: SmtpProfileRow[];
  projects: ProjectRow[];
  onChanged: () => void;
}) {
  const [deleteProfile] = useMutation(ADMIN_DELETE_SMTP_PROFILE);
  const [testProfile] = useMutation(ADMIN_TEST_SMTP_PROFILE);
  const [updateProject] = useMutation(ADMIN_UPDATE_PROJECT);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<SmtpProfileRow | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string | undefined>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleTest(profile: SmtpProfileRow) {
    setTestingId(profile.id);
    try {
      const { data } = await testProfile({ variables: { id: profile.id, clientId } });
      const result = data?.adminTestSmtpProfile;
      setTestResult((prev) => ({ ...prev, [profile.id]: result?.ok ? `Sent to ${result.to}` : result?.message }));
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [profile.id]: e instanceof Error ? e.message : "Test failed" }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(profile: SmtpProfileRow) {
    setRemovingId(profile.id);
    try {
      await deleteProfile({ variables: { id: profile.id, clientId } });
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAssignRouting(project: ProjectRow, smtpProfileId: string) {
    await updateProject({ variables: { id: project.id, input: { smtpProfileId: smtpProfileId || null } } });
    onChanged();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={CARD_CLASS}>
        <div className={PANEL_HEADER_CLASS}>
          <div>
            <div className="text-sm font-bold text-m-text">SMTP profiles</div>
            <p className="mt-0.5 text-xs text-m-text-muted">
              Used by the email Cloud Function when sends include this client&rsquo;s <code className="text-[11px]">clientId</code> and{" "}
              <code className="text-[11px]">smtpProfileId</code>.
            </p>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)}>
            Add Profile
          </Button>
        </div>

        {profiles.length === 0 ? (
          <div className="p-10">
            <EmptyState icon="mail" title="No SMTP profiles yet" description="Add one (e.g. SendGrid SMTP) so CSA can send email for this client." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-m-border/60 bg-m-neutral-50">
                  {["Label", "Host", "From", "Default", "Actions"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-m-text-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((s, idx) => (
                  <Fragment key={s.id}>
                    <tr className={idx < profiles.length - 1 ? "border-b border-m-border/40" : ""}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{s.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-m-text-muted">
                        {s.smtpHost}:{s.smtpPort}
                        {s.smtpSecure ? " (TLS)" : ""}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3" title={s.emailFrom}>
                        {s.emailFrom}
                      </td>
                      <td className="px-4 py-3">
                        {s.isDefault ? <span className="text-[11px] font-semibold text-m-success">Default</span> : <span className="text-m-text-subtle">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => void handleTest(s)} disabled={testingId === s.id || removingId === s.id}>
                            {testingId === s.id ? "Sending…" : "Test"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => void handleDelete(s)} disabled={removingId === s.id}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {testResult[s.id] && (
                      <tr>
                        <td colSpan={5} className="px-4 py-2 text-[11px] text-m-text-muted">
                          {testResult[s.id]}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={CARD_CLASS}>
        <div className="border-b border-m-border/60 px-5 py-3.5">
          <div className="text-sm font-bold text-m-text">Project routing</div>
          <p className="mt-1.5 text-xs text-m-text-muted">
            Choose which SMTP profile each commerce project uses. Leave as &ldquo;Client default&rdquo; to use the default profile above.
          </p>
        </div>
        {projects.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-m-text-muted">Add a project first to assign SMTP routing.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-m-border/60 bg-m-neutral-50">
                  {["Project key", "SMTP profile"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-m-text-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => (
                  <tr key={p.id} className={idx < projects.length - 1 ? "border-b border-m-border/40" : ""}>
                    <td className="px-4 py-3 font-mono font-semibold">{p.projectKey}</td>
                    <td className="px-4 py-3">
                      <select
                        value={p.smtpProfileId ?? ""}
                        onChange={(e) => void handleAssignRouting(p, e.target.value)}
                        className="h-8 max-w-[320px] cursor-pointer rounded-m-md border border-m-border bg-m-surface px-2 text-xs"
                      >
                        <option value="">Client default</option>
                        {profiles.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.emailFrom})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SmtpProfileModal
        isOpen={isAddOpen || !!editing}
        onClose={() => {
          setIsAddOpen(false);
          setEditing(null);
        }}
        clientId={clientId}
        existing={editing}
        profileCount={profiles.length}
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
  profileCount,
  onSaved
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  existing: SmtpProfileRow | null;
  profileCount: number;
  onSaved: () => void;
}) {
  const [createProfile] = useMutation(ADMIN_CREATE_SMTP_PROFILE);
  const [updateProfile] = useMutation(ADMIN_UPDATE_SMTP_PROFILE);

  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? "");
  const [smtpHost, setSmtpHost] = useState(existing?.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(existing?.smtpPort ?? 587);
  const [smtpSecure, setSmtpSecure] = useState(existing?.smtpSecure ?? false);
  const [smtpUser, setSmtpUser] = useState(existing?.smtpUser ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [emailFrom, setEmailFrom] = useState(existing?.emailFrom ?? "");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? profileCount === 0);
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
    setIsDefault(existing?.isDefault ?? profileCount === 0);
    setError(null);
  }, [isOpen, existing, profileCount]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (isEdit && existing) {
        await updateProfile({
          variables: {
            id: existing.id,
            clientId,
            input: { name, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword: smtpPassword || undefined, emailFrom, isDefault }
          }
        });
      } else {
        await createProfile({
          variables: { clientId, input: { name, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, emailFrom, isDefault } }
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save SMTP profile");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-m-neutral-950/45 p-4">
      <div className="w-full max-w-md overflow-y-auto rounded-m-xl bg-m-surface p-7 shadow-m-modal" style={{ maxHeight: "90vh" }}>
        <h2 className="mb-5 text-base font-bold text-m-primary">{isEdit ? "Edit SMTP Profile" : "Add SMTP Profile"}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className={LABEL_CLASS}>Label</label>
            <input className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Host</label>
              <input className={INPUT_CLASS} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL_CLASS}>Port</label>
              <input type="number" className={INPUT_CLASS} value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value) || 587)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Username</label>
              <input className={INPUT_CLASS} value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Password {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
              </label>
              <input type="password" className={INPUT_CLASS} value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} required={!isEdit} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>From header</label>
            <input className={INPUT_CLASS} placeholder="Support <noreply@example.com>" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} required />
          </div>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-xs text-m-text">
              <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} className="h-3.5 w-3.5 accent-m-primary" />
              Use TLS (typically port 465)
            </label>
            <label className="flex items-center gap-2 text-xs text-m-text">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-3.5 w-3.5 accent-m-primary" />
              Default profile for this client
            </label>
          </div>

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Add Profile"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
