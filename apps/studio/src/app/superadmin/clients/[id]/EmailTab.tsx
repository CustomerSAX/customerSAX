"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@apollo/client";
import {
  Button,
  Checkbox,
  EmptyState,
  Icon,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@csa/ui";
import {
  ADMIN_CREATE_SMTP_PROFILE,
  ADMIN_DELETE_SMTP_PROFILE,
  ADMIN_TEST_SMTP_PROFILE,
  ADMIN_UPDATE_PROJECT,
  ADMIN_UPDATE_SMTP_PROFILE,
} from "@/features/superadmin/api/queries";
import type { ProjectRow, SmtpProfileRow } from "./types";
import { CARD_CLASS, LABEL_CLASS, PANEL_HEADER_CLASS } from "./styles";

export function EmailTab({
  clientId,
  profiles,
  projects,
  onChanged,
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
              Used by the email Cloud Function when sends include this client&rsquo;s{" "}
              <code className="text-[11px]">clientId</code> and <code className="text-[11px]">smtpProfileId</code>.
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
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                {["Label", "Host", "From", "Default", ""].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
                {profiles.map((s, idx) => (
                  <Fragment key={s.id}>
                    <TableRow key={s.id} className={idx < profiles.length - 1 ? "border-b border-m-border/40" : ""}>
                      <TableCell className="whitespace-nowrap font-semibold">{s.name}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-m-text-muted">
                        {s.smtpHost}:{s.smtpPort}
                        {s.smtpSecure ? " (TLS)" : ""}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={s.emailFrom}>
                        {s.emailFrom}
                      </TableCell>
                      <TableCell>
                        {s.isDefault ? <span className="text-[11px] font-semibold text-m-success">Default</span> : <span className="text-m-text-subtle">-</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => void handleTest(s)} disabled={testingId === s.id || removingId === s.id}>
                            {testingId === s.id ? "Sending..." : "Test"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => void handleDelete(s)} disabled={removingId === s.id}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {testResult[s.id] && (
                      <TableRow key={`${s.id}-result`}>
                        <TableCell colSpan={5} className="py-2 text-[11px] text-m-text-muted">
                          {testResult[s.id]}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
            </TableBody>
          </Table>
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
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow>
                {["Project key", "SMTP profile"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
                {projects.map((p, idx) => (
                  <TableRow key={p.id} className={idx < projects.length - 1 ? "border-b border-m-border/40" : ""}>
                    <TableCell className="font-mono font-semibold">{p.projectKey}</TableCell>
                    <TableCell>
                      <Select
                        value={p.smtpProfileId ?? ""}
                        onChange={(e) => void handleAssignRouting(p, e.target.value)}
                        size="sm"
                        className="max-w-[320px]"
                      >
                        <option value="">Client default</option>
                        {profiles.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.emailFrom})
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
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
  onSaved,
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
            input: { name, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword: smtpPassword || undefined, emailFrom, isDefault },
          },
        });
      } else {
        await createProfile({
          variables: { clientId, input: { name, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, emailFrom, isDefault } },
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
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Host</label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL_CLASS}>Port</label>
              <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value) || 587)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Username</label>
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Password {isEdit && <span className="font-normal text-m-text-muted">(leave blank to keep)</span>}
              </label>
              <Input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} required={!isEdit} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>From header</label>
            <Input placeholder="Support <noreply@example.com>" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} required />
          </div>
          <div className="flex items-center gap-5">
            <Checkbox checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} label="Use TLS (typically port 465)" />
            <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} label="Default profile for this client" />
          </div>

          {error && <p className="text-xs text-m-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Add Profile"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
