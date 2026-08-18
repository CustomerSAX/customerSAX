"use client";

import { AppShell } from "@/components/shell/AppShell";
import { useCurrentUser, roleLabel } from "@/lib/use-current-user";
import {
  DetailPage,
  BackLink,
  EntityHeader,
  StatusPill,
  SummaryGrid,
  SummaryCard,
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  InfoList,
  InfoRow,
  QuickActions,
  QuickAction,
  CardEmpty,
} from "@csa/ui";
import { Avatar, Skeleton } from "@csa/ui";
import { useRouter } from "next/navigation";

/**
 * My Profile — the account-menu "My Profile" destination.
 * Read-only view of the REAL authenticated session (no profile-edit backend
 * exists, so nothing here is editable and nothing is fabricated). Every field
 * comes from /api/auth/me via useCurrentUser.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  return (
    <AppShell>
      <DetailPage>
        <BackLink href="/dashboard">Back to Dashboard</BackLink>

        {loading && !user ? (
          <Skeleton height={280} className="w-full" />
        ) : !user ? (
          <SectionCard>
            <CardEmpty
              icon="user-x"
              title="Not signed in"
              hint="Your session could not be loaded. Sign in again to view your profile."
            />
          </SectionCard>
        ) : (
          <>
            <EntityHeader
              title={
                <span className="flex items-center gap-3">
                  <Avatar name={user.name || user.email} size="md" />
                  {user.name || user.email || "My Profile"}
                </span>
              }
              status={<StatusPill tone="primary" dot={false}>{roleLabel(user.role)}</StatusPill>}
              meta={user.email ? `${user.email}` : undefined}
            />

            <SummaryGrid>
              <SummaryCard icon="mail" label="Email" value={user.email || "—"} />
              <SummaryCard icon="shield" label="Role" value={roleLabel(user.role)} tone="primary" />
              <SummaryCard icon="building" label="Tenant" value={user.tenantId || "—"} />
              <SummaryCard icon="folder" label="Projects" value={user.projects.length || "—"} />
              <SummaryCard
                icon="check-circle"
                label="Active Project"
                value={user.activeProjectKey || "—"}
              />
              <SummaryCard icon="fingerprint" label="User ID" value={user.id || "—"} />
            </SummaryGrid>

            <ContentGrid>
              <MainColumn>
                <SectionCard title="Account" icon="user">
                  <InfoList columns={2}>
                    <InfoRow label="Name" value={user.name} />
                    <InfoRow label="Email" value={user.email} />
                    <InfoRow label="Role" value={roleLabel(user.role)} />
                    <InfoRow label="Tenant / Organisation" value={user.tenantId} mono />
                    <InfoRow label="User ID" value={user.id} mono />
                    <InfoRow label="Active Project" value={user.activeProjectKey} mono />
                  </InfoList>
                </SectionCard>

                <SectionCard title={`Assigned Projects (${user.projects.length})`} icon="folder">
                  {user.projects.length === 0 ? (
                    <CardEmpty
                      icon="folder"
                      title="No projects assigned"
                      hint="Your account is not yet assigned to a commerce project."
                    />
                  ) : (
                    <ul className="flex flex-col divide-y divide-m-border/60">
                      {user.projects.map((project) => {
                        const active = project.projectKey === user.activeProjectKey;
                        return (
                          <li
                            key={`${project.clientId ?? "legacy"}:${project.projectKey}`}
                            className="flex items-center justify-between gap-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-semibold text-m-text">
                                {project.displayName || project.projectKey}
                              </div>
                              <div className="truncate font-mono text-[12px] text-m-text-muted">
                                {project.projectKey}
                                {project.clientId ? ` · ${project.clientId}` : ""}
                              </div>
                            </div>
                            {active && (
                              <StatusPill tone="success">Active</StatusPill>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>
              </MainColumn>

              <SideColumn>
                <QuickActions>
                  <QuickAction icon="log-out" label="Sign out" tone="danger" onClick={handleLogout} />
                </QuickActions>

                <SectionCard title="Session" icon="shield-check">
                  <InfoList>
                    <InfoRow
                      label="Project selection required"
                      value={user.requiresProjectSelection ? "Yes" : "No"}
                    />
                    <InfoRow label="Active client" value={user.activeClientId} mono />
                  </InfoList>
                </SectionCard>
              </SideColumn>
            </ContentGrid>
          </>
        )}
      </DetailPage>
    </AppShell>
  );
}
