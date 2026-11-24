"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Badge, Button } from "@csa/ui";
import { X } from "lucide-react";
import type { HubCatalogConnector } from "@/lib/connection-hub-catalog";
import styles from "@/features/csa-assistant/components/assistant-integrations.module.css";

export function PreviewConnectorDialog({
  connector,
  onClose
}: {
  connector: HubCatalogConnector;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.dialog}>
          <div className={styles.dialogHeader}>
            <div className="space-y-1">
              <Badge variant="neutral" size="sm">
                Catalog preview
              </Badge>
              <Dialog.Title className="text-lg font-semibold">
                {connector.name} setup
              </Dialog.Title>
            </div>
            <Dialog.Close aria-label={`Close ${connector.name} setup preview`}>
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.muted}>
            Preview the planned Connection Hub setup for {connector.name}. This catalog
            entry is not connected to a live account and cannot be enabled from this
            environment.
          </Dialog.Description>
          <dl className="grid gap-3 rounded-lg border border-m-border bg-m-surface-subtle p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                Category
              </dt>
              <dd className="mt-1 font-medium text-m-text">{connector.category}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                Authentication
              </dt>
              <dd className="mt-1 font-medium text-m-text">
                {authenticationLabel(connector.authenticationType)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                Actions
              </dt>
              <dd className="mt-1 font-medium text-m-text">
                {connector.actions.length} planned actions
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-m-text-muted">
                Activation
              </dt>
              <dd className="mt-1 font-medium text-m-text">
                Validated connector release required
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-m-text">Planned capabilities</h3>
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-m-border p-3">
              {connector.actions.map((action) => (
                <li
                  key={action.id}
                  className="flex items-center justify-between gap-3 text-sm text-m-text"
                >
                  <span>{action.name}</span>
                  <Badge variant="neutral" size="sm">
                    {action.readOnly ? "Read only" : "Write"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
          <p className={styles.muted}>
            Production activation will require approved credentials, validated scopes and
            an enabled Connection Hub release before any action can run.
          </p>
          <div className={styles.dialogActions}>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function authenticationLabel(type: string) {
  return (
    {
      OAUTH2: "OAuth 2.0",
      API_KEY: "API key",
      ACCESS_TOKEN: "Access token",
      BASIC_AUTH: "Basic auth"
    }[type.toUpperCase()] ?? type.replace(/_/g, " ")
  );
}
