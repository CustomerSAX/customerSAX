"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@csa/ui";
import { X } from "lucide-react";
import styles from "@/features/csa-assistant/components/assistant-integrations.module.css";

export type RemovalTarget = {
  connectorId: string;
  name: string;
  clientId: string;
  projectKey: string;
};

export function RemoveConnectorDialog({
  target,
  onClose,
  onRemoved
}: {
  target: RemovalTarget;
  onClose: () => void;
  onRemoved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();
  async function remove() {
    setBusy(true);
    setError("");
    let removed = false;
    try {
      const response = await fetch(
        `/api/connection-hub/connectors/${encodeURIComponent(target.connectorId)}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientId: target.clientId,
            projectKey: target.projectKey
          })
        }
      );
      const value = await response.json();
      if (!response.ok || value.ok !== true)
        throw new Error(
          typeof value.error === "string"
            ? value.error
            : "Unable to remove the connector. Refresh and retry."
        );
      if (
        value.clientId !== target.clientId ||
        value.projectKey !== target.projectKey ||
        value.connectorId !== target.connectorId ||
        value.connected !== false
      )
        throw new Error(
          "Project changed or the removal response was invalid. Refresh and retry."
        );
      removed = true;
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to remove the connector."
      );
    } finally {
      // Failed multi-action requests may have applied some changes too.
      await Promise.all(
        [
          "connection-hub-project-status",
          "algolia-plugin-status",
          "zendesk-plugin-status",
          "zendesk-connector-status"
        ].map((key) =>
          queryClient.invalidateQueries({
            queryKey: [key, target.clientId, target.projectKey]
          })
        )
      );
      setBusy(false);
    }
    if (removed) {
      router.refresh();
      onRemoved(`${target.name} removed from project ${target.projectKey}.`);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content
          className={styles.dialog}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className={styles.dialogHeader}>
            <Dialog.Title className="text-lg font-semibold">
              Remove {target.name}?
            </Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Close connector removal">
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.muted}>
            This disables all {target.name} actions in project{" "}
            <strong>{target.projectKey}</strong>. Features using these actions will stop
            working here. Shared accounts and other projects stay active.
          </Dialog.Description>
          {target.connectorId === "algolia" && (
            <p className={styles.muted}>Products will use the saved native provider.</p>
          )}
          {target.connectorId === "zendesk" && (
            <p className={styles.muted}>
              If Zendesk is your ticketing provider, reconnect it or select another
              provider to continue loading tickets.
            </p>
          )}
          {error && (
            <p role="alert" className={styles.fileError}>
              {error}
            </p>
          )}
          <div className={styles.dialogActions}>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Keep connector
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void remove()}>
              {busy ? "Removing…" : "Remove from project"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
