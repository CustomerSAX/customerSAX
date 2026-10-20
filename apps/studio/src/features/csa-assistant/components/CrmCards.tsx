"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon, Input } from "@csa/ui";
import {
  CRM_ACTIVITIES_QUERY,
  CRM_CONTACT_BY_ID_QUERY,
  LogActivityModal,
  UPDATE_ACTIVITY_MUTATION,
  formatDay,
  isOverdue,
  openExternal,
  providerLabel,
  todayIso,
  type CrmActivity,
  type CrmContact,
  type LogMode,
} from "../../crm/crm-shared";
import type { CrmContactCardArgs } from "../types";
import { notify } from "@/features/notifications/notification-store";

// Both components receive only a CRM contact id from the assistant and load
// every displayed value live from the connected CRM, so nothing on them is
// written by the model.

function useCrmContact(contactId: string) {
  const contactQuery = useQuery<{ crmContact: CrmContact | null }>(CRM_CONTACT_BY_ID_QUERY, {
    variables: { id: contactId },
    fetchPolicy: "network-only",
  });
  const activitiesQuery = useQuery<{ crmContactActivities: CrmActivity[] }>(CRM_ACTIVITIES_QUERY, {
    variables: { contactId },
    skip: !contactQuery.data?.crmContact,
    fetchPolicy: "network-only",
  });
  const activities = activitiesQuery.data?.crmContactActivities ?? [];
  const today = todayIso();
  const openFollowUps = activities
    .filter((a) => a.completed === false)
    .sort((a, b) => (a.activityDate ?? "9999").localeCompare(b.activityDate ?? "9999"));
  return {
    contact: contactQuery.data?.crmContact ?? null,
    loading: contactQuery.loading,
    error: contactQuery.error ?? activitiesQuery.error,
    activitiesLoading: activitiesQuery.loading,
    refetchActivities: () => activitiesQuery.refetch(),
    openFollowUps,
    overdue: openFollowUps.filter((a) => isOverdue(a, today)),
    lastDone: activities.find((a) => a.completed !== false) ?? null,
  };
}

// ─── CRM contact card (crm_contact_card) ──────────────────────────────────────

export function CrmContactCard({ args }: { args: CrmContactCardArgs }) {
  const { contact, loading, error, activitiesLoading, refetchActivities, openFollowUps, overdue, lastDone } = useCrmContact(args.contactId);
  const [logMode, setLogMode] = useState<LogMode | null>(null);
  const crmName = providerLabel(contact?.provider);

  if (loading) {
    return (
      <Card variant="default" className="my-2 max-w-md">
        <CardContent className="px-4 py-3 text-xs text-m-text-muted">Loading CRM contact…</CardContent>
      </Card>
    );
  }
  if (error || !contact) {
    return (
      <Card variant="default" className="my-2 max-w-md">
        <CardContent className="px-4 py-3 text-xs text-m-text-muted">
          {error ? `Unable to load this contact from the CRM right now (${error.message}).` : "This CRM contact could not be found."}
        </CardContent>
      </Card>
    );
  }

  const name = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "CRM contact";
  return (
    <Card variant="default" className="my-2 max-w-md border-l-4 border-l-m-primary">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon name="user-check" size="sm" className="text-m-primary" />
            <CardTitle className="truncate text-sm font-semibold">{name}</CardTitle>
          </div>
          <Badge variant="info" size="sm">{crmName}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-m-text-muted">
          {[contact.title, contact.accountName].filter(Boolean).join(" · ") || "No title or company in the CRM"}
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-4">
        <Row label="Account owner" value={contact.ownerName} />
        <Row label="Email" value={contact.email} />
        <Row label="Phone" value={contact.phone ?? contact.mobilePhone} />

        {/* Count only: each follow-up and its actions are in the pending list shown above this card. */}
        <div className="flex justify-between gap-3 border-t border-m-border pt-2 text-xs">
          <span className="text-m-text-muted">Open follow-ups</span>
          <span className="font-medium text-m-text">
            {activitiesLoading ? "…" : openFollowUps.length === 0 ? `None open in ${crmName}` : openFollowUps.length}
            {!activitiesLoading && overdue.length > 0 && <span className="text-m-error"> · {overdue.length} overdue</span>}
          </span>
        </div>

        {lastDone && (
          <div className="border-t border-m-border pt-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-m-text-muted">Last activity</p>
            <p className="text-xs text-m-text">
              {lastDone.subject || lastDone.description || "Activity"}
              <span className="text-m-text-muted"> · {formatDay(lastDone.activityDate ?? lastDone.createdAt?.slice(0, 10))}</span>
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-m-border pt-3">
          {contact.externalUrl && (
            <Button size="sm" variant="outline" onClick={() => openExternal(contact.externalUrl)}>
              Open in {crmName}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setLogMode({ type: "CALL", completed: true })}>
            Log call
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLogMode({ type: "TASK", completed: false })}>
            Add follow-up
          </Button>
        </div>
      </CardContent>

      {logMode && (
        <LogActivityModal
          contactId={contact.id}
          contactName={name}
          crmName={crmName}
          initial={logMode}
          onClose={() => setLogMode(null)}
          onLogged={refetchActivities}
        />
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-m-text-muted">{label}</span>
      <span className={`truncate text-right ${value ? "font-medium text-m-text" : "text-m-text-subtle"}`}>{value || "—"}</span>
    </div>
  );
}

// ─── CRM strip inside the case briefing card ─────────────────────────────────

export function CrmBriefingStrip({ contactId }: { contactId: string }) {
  const { contact, loading, error, activitiesLoading, openFollowUps, overdue } = useCrmContact(contactId);
  if (loading || error || !contact) return null;
  const crmName = providerLabel(contact.provider);
  const facts = [
    contact.accountName,
    contact.ownerName ? `Owner: ${contact.ownerName}` : null,
    activitiesLoading ? null : `${openFollowUps.length} open follow-up${openFollowUps.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return (
    <div className="rounded-m-md border border-m-border bg-m-surface-2 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-m-text-muted">{crmName}</p>
        {contact.externalUrl && (
          <button
            type="button"
            onClick={() => openExternal(contact.externalUrl)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-m-primary hover:text-m-primary-600"
          >
            Open <Icon name="external-link" size={12} />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-m-text">{facts.join(" · ") || "Contact found; no company or owner set"}</p>
      {overdue.length > 0 && (
        <p className="mt-1 text-xs font-semibold text-m-error">
          Overdue: {overdue.map((t) => `${t.subject || "Untitled task"} (${formatDay(t.activityDate)})`).join(", ")}
        </p>
      )}
    </div>
  );
}

// ─── Pending follow-ups with actions (rendered with every CRM contact card) ──

function dueLabel(task: CrmActivity, today: string) {
  if (!task.activityDate) return { text: "No due date", late: false };
  if (isOverdue(task, today)) return { text: `Overdue · ${formatDay(task.activityDate)}`, late: true };
  if (task.activityDate === today) return { text: "Due today", late: false };
  return { text: `Due ${formatDay(task.activityDate)}`, late: false };
}

export function CrmPendingFollowups({ contactId, onSuggest }: { contactId: string; onSuggest: (prompt: string) => void }) {
  const { contact, loading, error, activitiesLoading, refetchActivities, openFollowUps } = useCrmContact(contactId);
  const [updateActivity] = useMutation(UPDATE_ACTIVITY_MUTATION);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<{ id: string; date: string } | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [logMode, setLogMode] = useState<LogMode | null>(null);
  const today = todayIso();

  // Loading and error states are shown by the contact card below; the list appears only when something is pending.
  if (loading || activitiesLoading || error || !contact || openFollowUps.length === 0) return null;

  const crmName = providerLabel(contact.provider);
  const name = contact.fullName || contact.email || "this contact";
  // Overdue first, then by due date; undated last.
  const items = [...openFollowUps].sort((a, b) => {
    const lateA = isOverdue(a, today) ? 0 : 1;
    const lateB = isOverdue(b, today) ? 0 : 1;
    return lateA - lateB || (a.activityDate ?? "9999").localeCompare(b.activityDate ?? "9999");
  });

  async function run(task: CrmActivity, input: { completed?: boolean; activityDate?: string }) {
    setBusyId(task.id);
    setRowError(null);
    try {
      await updateActivity({ variables: { id: task.id, input } });
      setRescheduling(null);
      notify({
        variant: "success",
        title: input.completed ? "Follow-up marked done" : `Follow-up moved to ${formatDay(input.activityDate ?? null)}`,
        description: `${task.subject || "Task"} · ${crmName}`
      });
      await refetchActivities();
    } catch (e) {
      const message = e instanceof Error ? e.message : `${crmName} did not accept the change`;
      setRowError({ id: task.id, message });
      notify({ variant: "error", title: "Couldn't update the follow-up", description: message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card variant="default" className="my-2 max-w-xl border-l-4 border-l-m-warning">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="clock" size="sm" className="text-m-warning" />
            <CardTitle className="text-sm font-semibold">Pending in {crmName}</CardTitle>
          </div>
          <Badge variant={items.some((t) => isOverdue(t, today)) ? "error" : "neutral"} size="sm">
            {items.length} open
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-m-text-muted">{name}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ul className="divide-y divide-m-border">
          {items.map((task) => {
            const due = dueLabel(task, today);
            const busy = busyId === task.id;
            return (
              <li key={task.id} className="space-y-2 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-m-text">{task.subject || "Untitled task"}</p>
                    {task.description && <p className="truncate text-xs text-m-text-muted" title={task.description}>{task.description}</p>}
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${due.late ? "text-m-error" : "text-m-text-muted"}`}>{due.text}</span>
                </div>

                {rescheduling?.id === task.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={rescheduling.date}
                      min={today}
                      onChange={(e) => setRescheduling({ id: task.id, date: e.target.value })}
                      disabled={busy}
                      className="max-w-[170px]"
                    />
                    <Button size="sm" variant="primary" onClick={() => void run(task, { activityDate: rescheduling.date })} disabled={busy || !rescheduling.date}>
                      {busy ? "Saving…" : "Save date"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRescheduling(null)} disabled={busy}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={() => void run(task, { completed: true })} disabled={busy}>
                      {busy ? "Saving…" : "Mark done"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRescheduling({ id: task.id, date: task.activityDate && task.activityDate >= today ? task.activityDate : today })} disabled={busy}>
                      Reschedule
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLogMode({ type: "CALL", completed: true, subject: `Update: ${task.subject ?? "follow-up"}` })} disabled={busy}>
                      Log update
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onSuggest(
                          `Draft an email to ${name}${contact.email ? ` (${contact.email})` : ""} about the follow-up "${task.subject ?? "follow-up"}"${task.activityDate ? ` (due ${formatDay(task.activityDate)})` : ""}.`
                        )
                      }
                      disabled={busy}
                    >
                      Draft email
                    </Button>
                  </div>
                )}
                {rowError?.id === task.id && <p role="alert" className="text-xs font-semibold text-m-error">{rowError.message}</p>}
              </li>
            );
          })}
        </ul>
      </CardContent>

      {logMode && (
        <LogActivityModal
          contactId={contact.id}
          contactName={name}
          crmName={crmName}
          initial={logMode}
          onClose={() => setLogMode(null)}
          onLogged={refetchActivities}
        />
      )}
    </Card>
  );
}
