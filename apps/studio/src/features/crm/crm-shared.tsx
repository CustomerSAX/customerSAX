"use client";

import { useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { Button, FormField, Input, Label, Modal, Select, TextArea, StatusPill, type StatusTone } from "@csa/ui";
import { formatDate } from "@/lib/format-date";

// Shared CRM queries, types, formatting helpers and the Log activity form, used by
// the customer CRM tab and the CSA Assistant CRM cards. Data is read live from the
// project's connected CRM through the BFF; a value the CRM lacks is shown as missing,
// never filled in (see the project's no-mock-data rule).

export const ADDRESS_FIELDS = "street city state postalCode country";

export const CRM_PROVIDER_QUERY = gql`
  query CustomerCrmProvider {
    crmProvider
  }
`;

export const CRM_CONTACT_QUERY = gql`
  query CustomerCrmContact($email: String!) {
    crmContactByEmail(email: $email) {
      id
      provider
      externalUrl
      fullName
      firstName
      lastName
      email
      phone
      mobilePhone
      title
      accountId
      accountName
      ownerName
      mailingAddress { ${ADDRESS_FIELDS} }
      createdAt
      lastModifiedAt
    }
  }
`;

export const CRM_CONTACT_BY_ID_QUERY = gql`
  query CrmContactById($id: ID!) {
    crmContact(id: $id) {
      id
      provider
      externalUrl
      fullName
      firstName
      lastName
      email
      phone
      mobilePhone
      title
      accountId
      accountName
      ownerName
    }
  }
`;

/** Open tasks whose due day has passed (today's are due, not overdue). */
export function isOverdue(activity: CrmActivity, today = todayIso()) {
  return activity.completed === false && !!activity.activityDate && activity.activityDate < today;
}

export const CRM_ACTIVITIES_QUERY = gql`
  query CustomerCrmActivities($contactId: ID!) {
    crmContactActivities(contactId: $contactId, limit: 25) {
      id
      type
      subject
      description
      status
      completed
      activityDate
      ownerName
      createdAt
    }
  }
`;

export const CRM_ACCOUNT_QUERY = gql`
  query CustomerCrmAccount($accountId: ID!) {
    crmAccount(id: $accountId) {
      id
      externalUrl
      name
      industry
      type
      website
      phone
      ownerName
      billingAddress { ${ADDRESS_FIELDS} }
    }
    crmAccountContacts(accountId: $accountId, limit: 25) {
      id
      externalUrl
      fullName
      title
      email
      phone
    }
  }
`;

export const UPDATE_ACTIVITY_MUTATION = gql`
  mutation CrmUpdateActivity($id: ID!, $input: CrmActivityUpdateInput!) {
    updateCrmActivity(id: $id, input: $input) {
      id
      completed
      activityDate
      status
    }
  }
`;

export const LOG_ACTIVITY_MUTATION = gql`
  mutation CustomerCrmLogActivity($input: CrmActivityInput!) {
    logCrmActivity(input: $input) {
      id
    }
  }
`;

export type CrmAddress = { street?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null };
export type CrmContact = {
  id: string;
  provider: string;
  externalUrl?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  title?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  ownerName?: string | null;
  mailingAddress?: CrmAddress | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
};
export type CrmActivity = {
  id: string;
  type: "CALL" | "EMAIL" | "TASK" | "MEETING" | "OTHER";
  subject?: string | null;
  description?: string | null;
  status?: string | null;
  completed?: boolean | null;
  activityDate?: string | null;
  ownerName?: string | null;
  createdAt?: string | null;
};
export type CrmAccount = {
  id: string;
  externalUrl?: string | null;
  name: string;
  industry?: string | null;
  type?: string | null;
  website?: string | null;
  phone?: string | null;
  ownerName?: string | null;
  billingAddress?: CrmAddress | null;
};
export type CrmAccountContact = Pick<CrmContact, "id" | "externalUrl" | "fullName" | "title" | "email" | "phone">;

export const PROVIDER_LABELS: Record<string, string> = { salesforce: "Salesforce", hubspot: "HubSpot", zoho: "Zoho CRM" };
export function providerLabel(provider?: string | null) {
  if (!provider) return "CRM";
  return PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function formatAddress(address?: CrmAddress | null) {
  if (!address) return null;
  const street = address.street?.replace(/\r?\n/g, ", ");
  const parts = [street, address.city, [address.state, address.postalCode].filter(Boolean).join(" "), address.country];
  const text = parts.filter((p) => p && p.trim()).join(", ");
  return text || null;
}

/** CRM due dates are calendar days (YYYY-MM-DD); format them as local days so they never shift by timezone. */
export function formatDay(value?: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return formatDate(value);
  return formatDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export const ACTIVITY_TYPE: Record<CrmActivity["type"], { label: string; tone: StatusTone }> = {
  CALL: { label: "Call", tone: "info" },
  EMAIL: { label: "Email", tone: "primary" },
  TASK: { label: "Task", tone: "warning" },
  MEETING: { label: "Meeting", tone: "success" },
  OTHER: { label: "Other", tone: "neutral" },
};

export function activityStatusPill(activity: CrmActivity) {
  if (activity.completed === true) return <StatusPill tone="success">{activity.status || "Completed"}</StatusPill>;
  if (activity.completed === false) return <StatusPill tone="warning">{activity.status || "Open"}</StatusPill>;
  return activity.status ? <StatusPill tone="neutral">{activity.status}</StatusPill> : <span className="text-m-text-subtle">—</span>;
}

export function openExternal(url?: string | null) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export type LogMode = { type: "CALL" | "EMAIL" | "TASK"; completed: boolean; subject?: string };

/** Writes a call / email / task straight to the connected CRM, then reloads the activity lists. */
export function LogActivityModal({
  contactId,
  contactName,
  crmName,
  initial,
  onClose,
  onLogged,
}: {
  contactId: string;
  contactName: string;
  crmName: string;
  initial: LogMode;
  onClose: () => void;
  onLogged: () => Promise<unknown>;
}) {
  const [type, setType] = useState<LogMode["type"]>(initial.type);
  const [completed, setCompleted] = useState(initial.completed);
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState(todayIso());
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logActivity, { loading }] = useMutation(LOG_ACTIVITY_MUTATION);
  const isOpenTask = type === "TASK" && !completed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await logActivity({
        variables: {
          input: {
            contactId,
            type,
            subject: subject.trim(),
            description: description.trim() || null,
            activityDate: activityDate || null,
            ...(type === "CALL" && durationMinutes.trim() ? { durationMinutes: Number(durationMinutes) } : {}),
            ...(type === "TASK" ? { completed } : {}),
          },
        },
      });
      await onLogged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to save the activity in ${crmName}`);
    }
  }

  return (
    <Modal isOpen onClose={() => !loading && onClose()}>
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-m-border pb-3">
          <h3 className="text-base font-bold text-m-text">Log activity in {crmName}</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            ✕
          </Button>
        </div>
        <p className="text-[12.5px] text-m-text-muted">
          Saved directly to {contactName} in {crmName}.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField>
            <Label required>Type</Label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as LogMode["type"])}
              disabled={loading}
              options={[
                { value: "CALL", label: "Call" },
                { value: "EMAIL", label: "Email" },
                { value: "TASK", label: "Task / follow-up" },
              ]}
            />
          </FormField>
          <FormField>
            <Label required>{isOpenTask ? "Due date" : "Date"}</Label>
            <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} disabled={loading} required />
          </FormField>
        </div>

        <FormField>
          <Label required>Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={type === "CALL" ? "e.g. Called about delayed order" : type === "EMAIL" ? "e.g. Sent refund confirmation" : "e.g. Follow up on refund"}
            disabled={loading}
            required
          />
        </FormField>

        {type === "CALL" && (
          <FormField>
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="How long the call lasted"
              disabled={loading}
            />
          </FormField>
        )}

        <FormField>
          <Label>Details</Label>
          <TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} />
        </FormField>

        {type === "TASK" && (
          <div className="flex flex-col gap-2 border-t border-m-border pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-m-text">
              <input type="checkbox" checked={!completed} onChange={(e) => setCompleted(!e.target.checked)} disabled={loading} />
              Keep open as a follow-up (unticked = already done)
            </label>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-m-md bg-m-error-light px-3 py-2 text-[12.5px] font-semibold text-m-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={loading || !subject.trim()}>
            {loading ? "Saving…" : `Save to ${crmName}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
