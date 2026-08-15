"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import {
  PageShell,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  Icon,
  EmptyState,
  LoadingSpinner
} from "@csa/ui";
import { ADMIN_CLIENTS_QUERY, ADMIN_CREATE_CLIENT, ADMIN_SET_CLIENT_STATUS } from "@/features/superadmin/api/queries";

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: "active" | "blocked";
  projectCount: number;
  userCount: number;
}

/**
 * Superadmin client-organisation list — the entry point for the whole
 * superadmin console. Real data via the BFF's GraphQL API (apps/admin
 * subgraph) — this page never talks to MongoDB directly, matching the
 * rest of this repo's studio -> BFF -> subgraph -> real backend pattern.
 * Visually mirrors ct-csa-standalone's app/superadmin/clients/page.tsx
 * (same Meridian design tokens).
 */
export default function SuperadminClientsPage() {
  const router = useRouter();
  const { data, loading, error, refetch } = useQuery<{ adminClients: ClientRow[] }>(ADMIN_CLIENTS_QUERY, {
    fetchPolicy: "cache-and-network"
  });
  const [setClientStatus] = useMutation(ADMIN_SET_CLIENT_STATUS);

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const clients = data?.adminClients ?? [];

  async function handleToggleStatus(c: ClientRow) {
    const nextStatus = c.status === "active" ? "blocked" : "active";
    setTogglingId(c.id);
    try {
      await setClientStatus({ variables: { id: c.id, status: nextStatus } });
      await refetch();
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.contactEmail.toLowerCase().includes(q)
    );
  });

  const activeCount = clients.filter((c) => c.status === "active").length;
  const blockedCount = clients.filter((c) => c.status === "blocked").length;

  return (
    <PageShell maxWidth="lg">
      <div className="flex flex-col justify-between gap-4 rounded-m-xl border border-m-border bg-m-surface p-6 shadow-m-card sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-m-primary">Super Admin Portal</div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-m-text">Client Organisations</h1>
          <p className="max-w-3xl pt-0.5 text-[13px] leading-relaxed text-m-text-muted">
            Manage client accounts, commerce project connections, and administrative access.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
          <Button variant="primary" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)}>
            New Client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Total Organisations" value={loading ? "…" : clients.length} icon="building-2" />
        <MetricCard
          title="Active Tenants"
          value={loading ? "…" : activeCount}
          icon="check-circle-2"
          tone="success"
        />
        <MetricCard title="Blocked Tenants" value={loading ? "…" : blockedCount} icon="ban" tone="error" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-m-border/60 p-5">
          <div>
            <div className="text-sm font-bold text-m-text">All Client Organisations</div>
            <p className="mt-0.5 text-xs text-m-text-muted">
              {filtered.length} client organisation{filtered.length === 1 ? "" : "s"} configured
            </p>
          </div>
          <div className="relative w-64">
            <Icon
              name="search"
              size="xs"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m-text-muted"
            />
            <input
              type="search"
              placeholder="Search by name, slug or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-m-md border border-m-border bg-m-surface py-1.5 pl-8 pr-3 text-xs text-m-text outline-none focus:border-m-primary"
            />
          </div>
        </div>

        {loading && clients.length === 0 ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="p-5">
            <EmptyState icon="alert-triangle" title="Couldn't load clients" description={error.message} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon="building-2"
              title="No clients found"
              description={
                clients.length === 0
                  ? "No client organisations have been added yet."
                  : "No client organisations match your search criteria."
              }
              action={
                search ? (
                  <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                    Clear Search
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
                    Add First Client
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table className="border-0 shadow-none rounded-none">
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Admins</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} clickable onClick={() => router.push(`/superadmin/clients/${c.id}`)}>
                  <TableCell className="font-bold text-m-primary hover:underline">{c.name}</TableCell>
                  <TableCell className="font-mono text-[11px] font-semibold text-m-text-muted">{c.slug}</TableCell>
                  <TableCell className="font-medium">{c.contactEmail}</TableCell>
                  <TableCell>
                    <Badge
                      variant={c.status === "active" ? "success" : "error"}
                      appearance="subtle"
                      size="sm"
                      dot
                      className="uppercase tracking-wider"
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-semibold text-m-text">
                      <Icon name="briefcase" size="xs" className="text-m-text-muted" />
                      {c.projectCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-semibold text-m-text">
                      <Icon name="users" size="xs" className="text-m-text-muted" />
                      {c.userCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="sm" onClick={() => router.push(`/superadmin/clients/${c.id}`)}>
                        Manage
                      </Button>
                      <Button
                        variant={c.status === "active" ? "danger" : "secondary"}
                        size="sm"
                        disabled={togglingId === c.id}
                        onClick={() => void handleToggleStatus(c)}
                      >
                        {togglingId === c.id ? "…" : c.status === "active" ? "Block" : "Unblock"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AddClientModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={() => {
          setIsAddOpen(false);
          void refetch();
        }}
      />
    </PageShell>
  );
}

/**
 * Small local metric card matching ct-csa-standalone's MMetricCard
 * (icon chip with a per-metric tint) — @csa/ui's CardMetric always tints
 * its icon primary-blue, so this wraps Card directly instead.
 */
function MetricCard({
  title,
  value,
  icon,
  tone = "primary"
}: {
  title: string;
  value: ReactNode;
  icon: string;
  tone?: "primary" | "success" | "error";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-m-success-light text-m-success"
      : tone === "error"
        ? "bg-m-error-light text-m-error"
        : "bg-m-primary-50 text-m-primary";

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-m-text-muted">{title}</span>
        <span className={`rounded-m-md p-2 ${toneClasses}`}>
          <Icon name={icon} size="sm" />
        </span>
      </div>
      <span className="text-2xl font-bold tracking-tight text-m-text">{value}</span>
    </Card>
  );
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Custom fixed-overlay modal (not the shared Modal primitive) — matches
 * ct-csa-standalone's own AddClientModal exactly: icon header, larger
 * rounded corners, border-top footer.
 */
function AddClientModal({
  isOpen,
  onClose,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [createClient] = useMutation(ADMIN_CREATE_CLIENT);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setSlug("");
      setContactEmail("");
      setError(null);
    }
  }, [isOpen]);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !contactEmail.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await createClient({ variables: { name: name.trim(), contactEmail: contactEmail.trim(), slug: slug.trim() } });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-m-neutral-950/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-m-2xl border border-m-border bg-m-surface p-7 sm:p-8 shadow-m-modal">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-m-lg bg-m-primary/10 text-m-primary">
            <Icon name="building-2" size="md" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight text-m-text">New Client Organisation</h2>
            <p className="mt-1 text-xs leading-relaxed text-m-text-muted">
              Create a new client tenant organisation. You can connect commerce projects and invite admin users after
              creation.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-m-text">
              Organisation Name <span className="text-m-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Acme Corporation"
              className="h-10 w-full rounded-m-md border border-m-border bg-m-surface px-3.5 text-xs font-medium text-m-text outline-none transition-colors focus:border-m-primary focus:ring-1 focus:ring-m-primary placeholder:text-m-text-subtle"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-m-text">
                Slug <span className="text-m-error">*</span>
              </label>
              <span className="text-[11px] font-medium text-m-text-subtle">Auto-derived for URLs</span>
            </div>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-corporation"
              className="h-10 w-full rounded-m-md border border-m-border bg-m-neutral-50 px-3.5 text-xs font-mono text-m-text outline-none transition-colors focus:border-m-primary focus:bg-m-surface"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-m-text">
              Contact Email <span className="text-m-error">*</span>
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              placeholder="admin@acmecorp.com"
              className="h-10 w-full rounded-m-md border border-m-border bg-m-surface px-3.5 text-xs font-medium text-m-text outline-none transition-colors focus:border-m-primary focus:ring-1 focus:ring-m-primary placeholder:text-m-text-subtle"
            />
          </div>

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="mt-2 flex justify-end gap-3 border-t border-m-border pt-5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || !name.trim() || !contactEmail.trim()}>
              {isSubmitting ? "Creating…" : "Create Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
