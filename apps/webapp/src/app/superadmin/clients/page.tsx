"use client";

import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  PageShell,
  PageHeader,
  Card,
  CardMetric,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  Input,
  Icon,
  EmptyState,
  Modal,
  LoadingSpinner
} from "@csa/ui";
import type { CsaClientPublic } from "@/lib/mongo-clients";

type ClientRow = CsaClientPublic & { projectCount?: number; userCount?: number };

/**
 * Superadmin client-organisation list — the entry point for the whole
 * superadmin console. Real MongoDB-backed data via /api/superadmin/clients,
 * no mock rows.
 */
export default function SuperadminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const fetchClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load clients");
      setClients(data.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchClients();
  }, []);

  async function handleToggleStatus(c: ClientRow, e: MouseEvent) {
    e.stopPropagation();
    const nextStatus = c.status === "active" ? "blocked" : "active";
    setTogglingId(c.id);
    try {
      const res = await fetch(`/api/superadmin/clients/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) await fetchClients();
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
      <PageHeader
        title="Client Organizations"
        subtitle="Tenants using the CSA platform."
        actions={
          <Button variant="primary" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)}>
            Add Client
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardMetric title="Total Clients" value={clients.length} />
        <CardMetric title="Active" value={activeCount} />
        <CardMetric title="Blocked" value={blockedCount} />
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Search by name, slug, or email…"
          leftIcon={<Icon name="search" size="xs" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <EmptyState icon="alert-triangle" title="Couldn't load clients" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="building-2"
          title={clients.length === 0 ? "No client organizations yet" : "No matches"}
          description={
            clients.length === 0
              ? "Add the first client organization to get started."
              : "Try a different search term."
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} clickable onClick={() => router.push(`/superadmin/clients/${c.id}`)}>
                  <TableCell className="font-semibold text-m-text">{c.name}</TableCell>
                  <TableCell className="font-mono text-m-text-muted">{c.slug}</TableCell>
                  <TableCell>{c.contactEmail}</TableCell>
                  <TableCell className="text-m-text-muted">{c.projectCount ?? "—"}</TableCell>
                  <TableCell className="text-m-text-muted">{c.userCount ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "success" : "error"} appearance="subtle" size="sm">
                      {c.status === "active" ? "Active" : "Blocked"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-m-text-muted">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => void handleToggleStatus(c, e)}
                      disabled={togglingId === c.id}
                    >
                      {togglingId === c.id ? "…" : c.status === "active" ? "Block" : "Unblock"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AddClientModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={() => {
          setIsAddOpen(false);
          void fetchClients();
        }}
      />
    </PageShell>
  );
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AddClientModal({
  isOpen,
  onClose,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setContactEmail("");
      setError(null);
    }
  }, [isOpen]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !contactEmail.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contactEmail: contactEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create client");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit}>
        <Modal.Header title="Add Client Organization" onClose={onClose} />
        <Modal.Body>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">Organization name</label>
            <Input
              placeholder="Acme Corporation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-m-text-2">Contact email</label>
            <Input
              type="email"
              placeholder="admin@acme.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          {name.trim() && (
            <p className="text-[11px] text-m-text-muted">
              Slug: <span className="font-mono">{slugify(name)}</span>
            </p>
          )}
          {error && <p className="text-xs text-m-error">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Client"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
