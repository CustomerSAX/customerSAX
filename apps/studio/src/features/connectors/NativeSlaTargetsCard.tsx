"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { Button, Card, Icon } from "@csa/ui";
import { useCurrentUser } from "@/lib/use-current-user";
import { ADMIN_CLIENT_QUERY } from "@/features/superadmin/api/queries";
import { NativeSlaTargetsModal } from "./NativeSlaTargetsModal";

type ProjectRow = { id: string; projectKey: string; displayName?: string | null; ticketingProvider?: string | null };

/**
 * Entry point to the active project's native-ticket SLA targets. Shown only
 * while that project uses native ticketing; Zendesk/Freshdesk own their SLA rules.
 */
export function NativeSlaTargetsCard() {
  const { user } = useCurrentUser();
  const clientId = user?.activeClientId || user?.organization?.id;
  const { data } = useQuery(ADMIN_CLIENT_QUERY, { variables: { id: clientId }, skip: !clientId, fetchPolicy: "cache-and-network" });
  const [open, setOpen] = useState(false);
  const project = (data?.adminProjectsByClient as ProjectRow[] | undefined)?.find((p) => p.projectKey === user?.activeProjectKey);
  if (!clientId || !project || (project.ticketingProvider ?? "internal") !== "internal") return null;
  const displayName = project.displayName || project.projectKey;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border border-m-border bg-m-surface p-5 shadow-m-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-m-border bg-m-surface-subtle">
          <Icon name="clock" size="sm" />
        </div>
        <div>
          <h3 className="font-semibold text-m-text">Ticket SLA targets</h3>
          <p className="mt-0.5 text-sm text-m-text-muted">
            First-response and resolution targets per priority for native tickets in {displayName}.
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon name="settings" size="xs" className="mr-1.5" />
        Configure SLA targets
      </Button>
      {open && <NativeSlaTargetsModal isOpen onClose={() => setOpen(false)} clientId={clientId} project={{ id: project.id, displayName }} />}
    </Card>
  );
}
