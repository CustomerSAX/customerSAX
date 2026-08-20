"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client";
import {
  PageShell,
  Button,
  Checkbox,
  Icon,
  EmptyState,
  Input,
  LoadingSpinner,
  Radio,
  RadioGroup,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextArea,
} from "@csa/ui";
import {
  ADMIN_CLIENT_QUERY,
  ADMIN_UPDATE_CLIENT,
  ADMIN_SET_CLIENT_STATUS,
  ADMIN_CREATE_PROJECT,
  ADMIN_UPDATE_PROJECT,
  ADMIN_DELETE_PROJECT,
  ADMIN_TEST_PROJECT_CONNECTION,
  ADMIN_TEST_PROJECT_CREDENTIALS,
  ADMIN_CREATE_CLIENT_USER,
  ADMIN_ASSIGN_CLIENT_USER,
  ADMIN_UPDATE_CLIENT_USER,
  ADMIN_REMOVE_USER_FROM_PROJECT,
  ADMIN_REMOVE_USER_FROM_CLIENT
} from "@/features/superadmin/api/queries";
import { useCurrentUser } from "@/lib/use-current-user";
import { formatDate } from "@/lib/format-date";
import { EmailTab } from "./EmailTab";
import type { ClientDetail, Platform, ProjectRow, ShellMode, SsoConfig, SmtpProfileRow, TabKey, UserRow } from "./types";
import { CARD_CLASS, LABEL_CLASS, PANEL_HEADER_CLASS } from "./styles";

// ─── Types (mirror the apps/admin GraphQL schema) ──────────────────────────

function shellModeFromFlags(p: { standaloneB2cEnabled?: boolean | null; standaloneB2bEnabled?: boolean | null }): ShellMode {
  return p.standaloneB2bEnabled === true ? "b2b" : "b2c";
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
      <div className="flex flex-col justify-between gap-4 rounded-m-xl border border-m-border bg-m-surface p-6 shadow-m-card sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-m-primary">Client Details</div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold leading-tight tracking-tight text-m-text">
            <span>{client.name}</span>
            <ClientStatusBadge status={client.status} />
          </h1>
          <p className="max-w-3xl pt-0.5 text-[13px] leading-relaxed text-m-text-muted">
            {client.slug} · {client.contactEmail}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
          <Link href="/superadmin/clients">
            <Button variant="secondary" size="sm" leftIcon={<Icon name="arrow-left" size="xs" />}>
              All Clients
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex border-b border-m-border">
        {tabs.map((t) => (
            <Button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              variant="ghost"
              size="sm"
              className={`rounded-none border-b-2 px-4 py-2.5 transition-all hover:translate-y-0 ${
              tab === t.key
                ? "border-m-primary font-bold text-m-primary"
                : "border-transparent font-medium text-m-text-muted hover:text-m-text"
            }`}
          >
            {t.label}
            {t.count >= 0 && ` (${t.count})`}
          </Button>
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
    queueMicrotask(() => {
      setName(client.name);
      setContactEmail(client.contactEmail);
    });
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
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Contact Email</label>
              <Input
                type="email"
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
            <Input className="font-mono text-m-text-muted" value={client.slug} disabled />
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
            ["Created at", formatDate(client.createdAt)],
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
  const [redirectUri, setRedirectUri] = useState("/api/sso/oidc/callback");

  const oidcSecretSet = stored.oidcClientSecretSet ?? false;
  const idpCertSet = stored.idpCertSet ?? false;

  useEffect(() => {
    queueMicrotask(() => {
      setRedirectUri(`${window.location.origin}/api/sso/oidc/callback`);
    });
  }, []);

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
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value as SsoConfig["provider"])}
          >
            <option value="none">None — password only</option>
            <option value="oidc">OpenID Connect (OAuth 2.0)</option>
            <option value="saml">SAML 2.0 (store metadata; runtime sign-in not wired yet)</option>
          </Select>
        </div>

        {provider === "oidc" && (
          <>
            <div>
              <label className={LABEL_CLASS}>
                Issuer URL {!issuer && <span className="text-m-error">*</span>}
              </label>
              <Input className="font-mono" placeholder="https://login.microsoftonline.com/{tenant}/v2.0" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={LABEL_CLASS}>
                  Client ID {!oidcClientId && <span className="text-m-error">*</span>}
                </label>
                <Input className="font-mono" value={oidcClientId} onChange={(e) => setOidcClientId(e.target.value)} />
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
                <Input
                  type="password"
                  className="font-mono"
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
              <Input placeholder="e.g. Sign in with Azure AD" value={providerDisplayName} onChange={(e) => setProviderDisplayName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Extra scopes <span className="font-normal text-m-text-subtle">— optional, space-separated</span>
              </label>
              <Input placeholder="e.g. Groups.Claim" value={extraScopes} onChange={(e) => setExtraScopes(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                OAuth connection <span className="font-normal text-m-text-subtle">— optional</span>
              </label>
              <Input
                className="font-mono"
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
              <Input placeholder="https://idp.example.com/app/xxx/sso/saml" value={entryPointUrl} onChange={(e) => setEntryPointUrl(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                IdP issuer / entity ID {!samlIssuer && <span className="text-m-error">*</span>}
              </label>
              <Input value={samlIssuer} onChange={(e) => setSamlIssuer(e.target.value)} />
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
              <TextArea
                className="font-mono text-[11px]"
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
    <RadioGroup name={name} value={value} onChange={(mode) => onChange(mode as ShellMode)} className={compact ? "flex-row gap-3" : "gap-2.5"}>
      {options.map((option) => (
        <div key={option.mode} className={compact ? "flex items-center" : ""}>
          {compact ? (
            <Radio value={option.mode} label={<span className="font-semibold">{option.mode.toUpperCase()}</span>} />
          ) : (
            <Radio value={option.mode} label={option.label} hint={option.hint} />
          )}
        </div>
      ))}
    </RadioGroup>
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
  const [deleteProject] = useMutation(ADMIN_DELETE_PROJECT);
  const [updateProject] = useMutation(ADMIN_UPDATE_PROJECT);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                {["Project Key", "Display Name", "API Region", "Client ID", "Secret", "Shell", "Added", ""].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
                {projects.map((p, idx) => (
                    <TableRow key={p.id} className={idx < projects.length - 1 ? "border-b border-m-border/40" : ""}>
                      <TableCell className="font-mono font-semibold">
                        <Button type="button" variant="ghost" size="sm" className="h-auto px-0 py-0 font-mono text-m-primary underline hover:translate-y-0" onClick={() => setEditing(p)}>
                          {p.projectKey}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {p.displayName}
                        <span className="ml-2 rounded-full border border-m-primary-200 bg-m-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-m-primary">
                          {p.platform === "shopify" ? "Shopify" : p.platform === "bigcommerce" ? "BigCommerce" : "CommerceTools"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-m-text-muted" title={p.ctApiUrl}>
                        {p.ctApiUrl?.replace("https://", "") || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-m-text-muted">
                        {p.platform === "shopify" ? p.shopifyStoreDomain : p.platform === "bigcommerce" ? p.bigcommerceClientId : p.ctClientId}
                      </TableCell>
                      <TableCell className="font-mono tracking-wider text-m-text-subtle">{p.ctClientSecretMasked}</TableCell>
                      <TableCell>
                        <ShellModePicker name={`shell-${p.id}`} value={shellModeFromFlags(p)} onChange={(mode) => void handleShellChange(p, mode)} compact />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-m-text-muted">{formatDate(p.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button variant="danger" size="sm" onClick={() => void handleDelete(p)} disabled={removingId === p.id}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                ))}
            </TableBody>
          </Table>
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
  const { user: currentUser } = useCurrentUser();

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
      queueMicrotask(() => {
        setError(null);
        setTestResult(null);
      });
      return;
    }
    queueMicrotask(() => {
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
      setError(null);
      setTestResult(null);
    });
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
        if (!currentUser) {
          setError("Still loading your session — try again in a moment.");
          return;
        }
        const input =
          platform === "shopify"
            ? { platform, projectKey, displayName, shopifyStoreDomain, shopifyAdminAccessToken, shopifyApiVersion, ...shellFlags }
            : platform === "bigcommerce"
              ? { platform, projectKey, displayName, bigcommerceStoreHash, bigcommerceClientId, bigcommerceAccessToken, ...shellFlags }
              : { platform, projectKey, displayName, ctApiUrl, ctAuthUrl, ctClientId, ctClientSecret, scopes: scopes || undefined, ...shellFlags };
        await createProject({ variables: { clientId, input, createdBy: currentUser.email } });
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
            <Select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              disabled={isEdit}
            >
              <option value="commercetools">CommerceTools</option>
              <option value="shopify">Shopify</option>
              <option value="bigcommerce">BigCommerce</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Project Key *</label>
              <Input className="font-mono" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} disabled={isEdit} required />
            </div>
            <div>
              <label className={LABEL_CLASS}>Display Name *</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
          </div>

          {platform === "commercetools" && (
            <>
              <div>
                <label className={LABEL_CLASS}>CT API URL *</label>
                <Input placeholder="https://api.us-central1.gcp.commercetools.com" value={ctApiUrl} onChange={(e) => setCtApiUrl(e.target.value)} required />
              </div>
              <div>
                <label className={LABEL_CLASS}>CT Auth URL *</label>
                <Input placeholder="https://auth.us-central1.gcp.commercetools.com" value={ctAuthUrl} onChange={(e) => setCtAuthUrl(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Client ID *</label>
                  <Input className="font-mono" value={ctClientId} onChange={(e) => setCtClientId(e.target.value)} required />
                </div>
                <div>
                  <label className={LABEL_CLASS}>
                    Client Secret * {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
                  </label>
                  <Input type="password" className="font-mono" value={ctClientSecret} onChange={(e) => setCtClientSecret(e.target.value)} required={!isEdit} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Scopes — optional, defaults to manage_project:&lt;key&gt;</label>
                <Input value={scopes} onChange={(e) => setScopes(e.target.value)} />
              </div>
            </>
          )}

          {platform === "shopify" && (
            <>
              <div>
                <label className={LABEL_CLASS}>Store Domain *</label>
                <Input className="font-mono" placeholder="my-store.myshopify.com" value={shopifyStoreDomain} onChange={(e) => setShopifyStoreDomain(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>
                    Admin API Token * {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
                  </label>
                  <Input type="password" className="font-mono" placeholder="shpat_..." value={shopifyAdminAccessToken} onChange={(e) => setShopifyAdminAccessToken(e.target.value)} required={!isEdit} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>API Version *</label>
                  <Input className="font-mono" placeholder="2024-10" value={shopifyApiVersion} onChange={(e) => setShopifyApiVersion(e.target.value)} required />
                </div>
              </div>
            </>
          )}

          {platform === "bigcommerce" && (
            <>
              <div>
                <label className={LABEL_CLASS}>Store Hash *</label>
                <Input className="font-mono" value={bigcommerceStoreHash} onChange={(e) => setBigcommerceStoreHash(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Client ID *</label>
                  <Input className="font-mono" value={bigcommerceClientId} onChange={(e) => setBigcommerceClientId(e.target.value)} required />
                </div>
                <div>
                  <label className={LABEL_CLASS}>
                    Access Token * {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
                  </label>
                  <Input type="password" className="font-mono" value={bigcommerceAccessToken} onChange={(e) => setBigcommerceAccessToken(e.target.value)} required={!isEdit} />
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
            <Button type="submit" variant="primary" disabled={isSaving || (!isEdit && !currentUser)}>
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
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                {["Email", "Name", "Projects", ""].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((u, idx) => (
                  <TableRow key={u.email} className={`align-top ${idx < users.length - 1 ? "border-b border-m-border/40" : ""}`}>
                    <TableCell className="whitespace-nowrap font-medium">{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-m-text-muted">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>
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
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title={`Remove from ${p.projectKey}`}
                                disabled={removingEmail === u.email}
                                onClick={() => void handleRemoveFromProject(u.email, p.projectKey)}
                                className="h-auto px-0.5 py-0 text-sm leading-none opacity-70 hover:translate-y-0 hover:opacity-100 disabled:opacity-30"
                              >
                                ×
                              </Button>
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
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
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
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
  const { user: currentUser } = useCurrentUser();

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
    queueMicrotask(() => {
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
    });
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

    if (!currentUser) {
      setError("Still loading your session — try again in a moment.");
      setIsSaving(false);
      return;
    }

    try {
      if (isEdit && existing) {
        const projectsPayload = selectedKeys.map((projectKey) => ({ projectKey, role: editRoles[projectKey] ?? "admin" }));
        await updateUser({
          variables: {
            clientId,
            grantedBy: currentUser.email,
            input: { email: existing.email, firstName, lastName, password: password.trim() || undefined, projects: projectsPayload }
          }
        });
      } else if (mode === "create") {
        const projectsPayload = selectedKeys.map((projectKey) => ({ projectKey, role: bulkRole }));
        await createUser({
          variables: {
            clientId,
            grantedBy: currentUser.email,
            input: { email, password, firstName: firstName || undefined, lastName: lastName || undefined, projects: projectsPayload }
          }
        });
      } else {
        const projectsPayload = selectedKeys.map((projectKey) => ({ projectKey, role: bulkRole }));
        await assignUser({ variables: { clientId, grantedBy: currentUser.email, input: { email, projects: projectsPayload } } });
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
            <Button
              type="button"
              onClick={() => setMode("create")}
              variant={mode === "create" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 rounded-m-sm py-2 hover:translate-y-0"
            >
              Create New User
            </Button>
            <Button
              type="button"
              onClick={() => setMode("assign")}
              variant={mode === "assign" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 rounded-m-sm py-2 hover:translate-y-0"
            >
              Assign Existing User
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className={LABEL_CLASS}>Email *</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} required />
          </div>

          {(mode === "create" || isEdit) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>First Name</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Last Name</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}

          {(mode === "create" || isEdit) && (
            <div>
              <label className={LABEL_CLASS}>
                {isEdit ? "New Password" : "Password *"}{" "}
                <span className="font-normal text-m-text-subtle">{isEdit ? "(leave blank to keep current)" : "(min 8 chars)"}</span>
              </label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!isEdit} />
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
                      <Checkbox checked={checked} onChange={() => toggleProject(p.projectKey)} size="sm" />
                      <div className="flex-1 cursor-pointer" onClick={() => toggleProject(p.projectKey)}>
                        <div className="text-xs font-medium text-m-text">{p.projectKey}</div>
                        {p.displayName && <div className="text-[11px] text-m-text-muted">{p.displayName}</div>}
                      </div>
                      {isEdit && (
                        <Select
                          value={editRoles[p.projectKey] ?? "admin"}
                          disabled={!checked}
                          onChange={(e) => setEditRoles((prev) => ({ ...prev, [p.projectKey]: e.target.value }))}
                          size="sm"
                          className="max-w-[110px] text-[11px]"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </Select>
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
              <Select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
                <option value="admin">Admin — full access, user management</option>
                <option value="member">Member — view-only access</option>
              </Select>
            </div>
          )}

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving || !isFormValid || !currentUser}>
              {isSaving ? (isEdit ? "Saving…" : mode === "assign" ? "Assigning…" : "Creating…") : isEdit ? "Save Changes" : mode === "assign" ? "Assign User" : "Create User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
