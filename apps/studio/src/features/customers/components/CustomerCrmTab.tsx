"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Icon,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  CardAction,
  CardEmpty,
  InfoList,
  InfoRow,
  StatusPill,
} from "@csa/ui";
import { formatDate, formatDateTime } from "@/lib/format-date";
import {
  ACTIVITY_TYPE,
  CRM_ACCOUNT_QUERY,
  CRM_ACTIVITIES_QUERY,
  CRM_CONTACT_QUERY,
  CRM_PROVIDER_QUERY,
  LogActivityModal,
  activityStatusPill,
  formatAddress,
  formatDay,
  openExternal,
  providerLabel,
  type CrmAccount,
  type CrmAccountContact,
  type CrmActivity,
  type CrmContact,
  type LogMode,
} from "../../crm/crm-shared";

// CRM data for this customer, read live from the project's connected CRM
// (Superadmin → Projects → CRM) through the BFF. Matched to the store customer
// by email. Nothing here is stored in CSA, and nothing is filled in when the CRM
// has no value — see the project's no-mock-data rule.

export function CustomerCrmTab({ customerEmail }: { customerEmail?: string | null }) {
  const email = customerEmail?.trim() || "";

  const providerQuery = useQuery<{ crmProvider: string }>(CRM_PROVIDER_QUERY, { fetchPolicy: "network-only" });
  const provider = providerQuery.data?.crmProvider;
  const connected = !!provider && provider !== "none";

  const contactQuery = useQuery<{ crmContactByEmail: CrmContact | null }>(CRM_CONTACT_QUERY, {
    variables: { email },
    skip: !connected || !email,
    fetchPolicy: "network-only",
  });
  const contact = contactQuery.data?.crmContactByEmail ?? null;

  const activitiesQuery = useQuery<{ crmContactActivities: CrmActivity[] }>(CRM_ACTIVITIES_QUERY, {
    variables: { contactId: contact?.id },
    skip: !contact?.id,
    fetchPolicy: "network-only",
  });
  const accountQuery = useQuery<{ crmAccount: CrmAccount | null; crmAccountContacts: CrmAccountContact[] }>(CRM_ACCOUNT_QUERY, {
    variables: { accountId: contact?.accountId },
    skip: !contact?.accountId,
    fetchPolicy: "network-only",
  });

  const crmName = providerLabel(contact?.provider ?? provider);
  const [logMode, setLogMode] = useState<LogMode | null>(null);

  // ── Connection / matching states ────────────────────────────────────────
  if (providerQuery.loading) {
    return (
      <SectionCard title="CRM" icon="user-check">
        <p className="py-6 text-center text-xs text-m-text-muted">Checking this project&apos;s CRM connection…</p>
      </SectionCard>
    );
  }
  if (providerQuery.error) {
    return (
      <SectionCard title="CRM" icon="user-check">
        <CardEmpty icon="alert-triangle" title="Unable to reach the CRM service right now" hint={providerQuery.error.message} />
      </SectionCard>
    );
  }
  if (!connected) {
    return (
      <SectionCard title="CRM" icon="user-check">
        <CardEmpty
          icon="user-check"
          title="No CRM connected for this project"
          hint="A superadmin can connect one in Superadmin → Client Organisations → Projects → CRM."
        />
      </SectionCard>
    );
  }
  if (!email) {
    return (
      <SectionCard title={`${crmName} Contact`} icon="user-check">
        <CardEmpty icon="mail" title="No email on this customer" hint="CRM contacts are matched by email address." />
      </SectionCard>
    );
  }
  if (contactQuery.loading) {
    return (
      <SectionCard title={`${crmName} Contact`} icon="user-check">
        <p className="py-6 text-center text-xs text-m-text-muted">Looking up {email} in {crmName}…</p>
      </SectionCard>
    );
  }
  if (contactQuery.error) {
    return (
      <SectionCard title={`${crmName} Contact`} icon="user-check">
        <CardEmpty icon="alert-triangle" title={`Unable to load data from ${crmName} right now`} hint={contactQuery.error.message} />
      </SectionCard>
    );
  }
  if (!contact) {
    return (
      <SectionCard title={`${crmName} Contact`} icon="user-check">
        <CardEmpty icon="user-check" title={`No ${crmName} contact matches this email`} hint={`Searched ${crmName} for ${email}.`} />
      </SectionCard>
    );
  }

  // ── Contact found ───────────────────────────────────────────────────────
  const activities = activitiesQuery.data?.crmContactActivities ?? [];
  const openFollowUps = activities.filter((a) => a.completed === false);
  const account = accountQuery.data?.crmAccount ?? null;
  const colleagues = (accountQuery.data?.crmAccountContacts ?? []).filter((c) => c.id !== contact.id);

  return (
    <ContentGrid>
      <MainColumn>
        <SectionCard
          title={`${crmName} Contact`}
          icon="user-check"
          action={
            contact.externalUrl ? (
              <CardAction onClick={() => openExternal(contact.externalUrl)}>
                Open in {crmName} <Icon name="external-link" size={12} />
              </CardAction>
            ) : undefined
          }
        >
          <InfoList columns={2}>
            <InfoRow label="Name" value={contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ")} />
            <InfoRow label="Title" value={contact.title} />
            <InfoRow label="Email" value={contact.email} />
            <InfoRow label="Phone" value={contact.phone} />
            <InfoRow label="Mobile" value={contact.mobilePhone} />
            <InfoRow label="Account Owner" value={contact.ownerName} />
            <InfoRow label="Company" value={contact.accountName} />
            <InfoRow label="Mailing Address" value={formatAddress(contact.mailingAddress)} />
            <InfoRow label={`Created in ${crmName}`} value={formatDateTime(contact.createdAt)} />
            <InfoRow label="Last Modified" value={formatDateTime(contact.lastModifiedAt)} />
          </InfoList>
        </SectionCard>

        <SectionCard
          title="Open Follow-ups"
          icon="clock"
          bodyClassName="p-0"
          action={
            <CardAction onClick={() => setLogMode({ type: "TASK", completed: false })}>
              <Icon name="plus" size={12} /> Add follow-up
            </CardAction>
          }
        >
          {activitiesQuery.loading ? (
            <p className="py-6 text-center text-xs text-m-text-muted">Loading follow-ups…</p>
          ) : activitiesQuery.error ? (
            <CardEmpty icon="alert-triangle" title={`Unable to load activity from ${crmName}`} hint={activitiesQuery.error.message} />
          ) : openFollowUps.length === 0 ? (
            <CardEmpty icon="check-circle" title="No open follow-ups" hint={`${crmName} has no open tasks for this contact.`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openFollowUps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-m-text">{a.subject || "—"}</TableCell>
                    <TableCell>{formatDay(a.activityDate)}</TableCell>
                    <TableCell>{activityStatusPill(a)}</TableCell>
                    <TableCell>{a.ownerName || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          icon="activity"
          bodyClassName="p-0"
          action={
            <CardAction onClick={() => setLogMode({ type: "CALL", completed: true })}>
              <Icon name="plus" size={12} /> Log activity
            </CardAction>
          }
        >
          {activitiesQuery.loading ? (
            <p className="py-6 text-center text-xs text-m-text-muted">Loading activity…</p>
          ) : activitiesQuery.error ? (
            <CardEmpty icon="alert-triangle" title={`Unable to load activity from ${crmName}`} hint={activitiesQuery.error.message} />
          ) : activities.length === 0 ? (
            <CardEmpty icon="activity" title="No activity recorded" hint={`${crmName} has no calls, emails, tasks or meetings for this contact.`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => {
                  const type = ACTIVITY_TYPE[a.type] ?? ACTIVITY_TYPE.OTHER;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <StatusPill tone={type.tone} dot={false}>{type.label}</StatusPill>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="font-medium text-m-text">{a.subject || "—"}</div>
                        {a.description && <div className="truncate text-[12px] text-m-text-muted" title={a.description}>{a.description}</div>}
                      </TableCell>
                      <TableCell>{a.activityDate ? formatDay(a.activityDate) : formatDate(a.createdAt)}</TableCell>
                      <TableCell>{activityStatusPill(a)}</TableCell>
                      <TableCell>{a.ownerName || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </MainColumn>

      <SideColumn>
        <SectionCard
          title="Company"
          icon="building-2"
          action={
            account?.externalUrl ? (
              <CardAction onClick={() => openExternal(account.externalUrl)}>
                Open <Icon name="external-link" size={12} />
              </CardAction>
            ) : undefined
          }
        >
          {!contact.accountId ? (
            <CardEmpty icon="building-2" title="No company linked" hint={`This ${crmName} contact isn't linked to a company.`} />
          ) : accountQuery.loading ? (
            <p className="py-4 text-center text-xs text-m-text-muted">Loading company…</p>
          ) : accountQuery.error ? (
            <CardEmpty icon="alert-triangle" title={`Unable to load the company from ${crmName}`} hint={accountQuery.error.message} />
          ) : !account ? (
            <CardEmpty icon="building-2" title="Company not found" hint={`${crmName} returned no company for this contact.`} />
          ) : (
            <InfoList>
              <InfoRow label="Name" value={account.name} />
              <InfoRow label="Industry" value={account.industry} />
              <InfoRow label="Type" value={account.type} />
              <InfoRow label="Website" value={account.website} />
              <InfoRow label="Phone" value={account.phone} />
              <InfoRow label="Account Owner" value={account.ownerName} />
              <InfoRow label="Billing Address" value={formatAddress(account.billingAddress)} />
            </InfoList>
          )}
        </SectionCard>

        {contact.accountId && account && (
          <SectionCard title={`Other Contacts at ${account.name}`} icon="users" bodyClassName="p-0">
            {colleagues.length === 0 ? (
              <CardEmpty icon="users" title="No other contacts" hint={`${crmName} has no other contacts at this company.`} />
            ) : (
              <ul className="divide-y divide-m-border/70">
                {colleagues.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-m-text">{c.fullName || "—"}</div>
                      <div className="truncate text-[12px] text-m-text-muted">{[c.title, c.email || c.phone].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    {c.externalUrl && (
                      <CardAction onClick={() => openExternal(c.externalUrl)}>
                        <Icon name="external-link" size={12} />
                      </CardAction>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </SideColumn>

      {logMode && (
        <LogActivityModal
          contactId={contact.id}
          contactName={contact.fullName || contact.email || "this contact"}
          crmName={crmName}
          initial={logMode}
          onClose={() => setLogMode(null)}
          onLogged={() => activitiesQuery.refetch()}
        />
      )}
    </ContentGrid>
  );
}
