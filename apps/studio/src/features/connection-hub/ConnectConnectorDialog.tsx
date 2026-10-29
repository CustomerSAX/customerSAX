"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "@csa/ui";
import { X } from "lucide-react";
import type { HubCatalogConnector } from "@/lib/connection-hub-catalog";
import styles from "@/features/csa-assistant/components/assistant-integrations.module.css";

export type ConnectionTarget = HubCatalogConnector & {
  clientId: string;
  projectKey: string;
};

function credentialLabel(type: string) {
  return (
    (
      {
        API_KEY: "API key",
        API_TOKEN: "API token",
        PERSONAL_ACCESS_TOKEN: "Personal access token",
        ACCESS_TOKEN: "Access token",
        OAUTH_ACCESS_TOKEN: "OAuth access token",
        OAUTH2: "OAuth credential or access token",
        SECRET_TEXT: "Secret credential"
      } as Record<string, string>
    )[type] ?? "Credential"
  );
}

export function ConnectConnectorDialog({
  target,
  onClose,
  onConnected
}: {
  target: ConnectionTarget;
  onClose: () => void;
  onConnected: (message: string) => void;
}) {
  const defaults = useMemo(
    () => target.actions.filter((action) => action.readOnly).map((action) => action.id),
    [target.actions]
  );
  const [account, setAccount] = useState("");
  const [credential, setCredential] = useState("");
  const [resource, setResource] = useState("");
  const [actions, setActions] = useState(
    defaults.length ? defaults : target.actions[0] ? [target.actions[0].id] : []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();

  function toggle(actionId: string) {
    setActions((current) =>
      current.includes(actionId)
        ? current.filter((item) => item !== actionId)
        : [...current, actionId]
    );
  }

  async function connect() {
    setBusy(true);
    setError("");
    let connected = false;
    try {
      const response = await fetch(
        `/api/connection-hub/connectors/${encodeURIComponent(target.id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientId: target.clientId,
            projectKey: target.projectKey,
            account: account.trim(),
            credential,
            resource: resource.trim(),
            actions
          })
        }
      );
      const value: unknown = await response.json();
      if (
        !response.ok ||
        typeof value !== "object" ||
        value === null ||
        !("ok" in value) ||
        value.ok !== true
      )
        throw new Error(
          typeof value === "object" &&
            value !== null &&
            "error" in value &&
            typeof value.error === "string"
            ? value.error
            : "Unable to connect this service. Refresh and retry."
        );
      if (
        !("clientId" in value) ||
        value.clientId !== target.clientId ||
        !("projectKey" in value) ||
        value.projectKey !== target.projectKey ||
        !("connectorId" in value) ||
        value.connectorId !== target.id ||
        !("connected" in value) ||
        value.connected !== true
      )
        throw new Error("Project changed or the connection response was invalid.");
      connected = true;
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to connect this service."
      );
    } finally {
      await queryClient.invalidateQueries({
        queryKey: ["connection-hub-project-status", target.clientId, target.projectKey]
      });
      setBusy(false);
    }
    if (connected) {
      setCredential("");
      router.refresh();
      onConnected(`${target.name} connected to project ${target.projectKey}.`);
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
              Connect {target.name}
            </Dialog.Title>
            <Dialog.Close disabled={busy} aria-label={`Close ${target.name} connection`}>
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.muted}>
            Store an encrypted {credentialLabel(target.authenticationType).toLowerCase()}{" "}
            and enable selected actions for <strong>{target.projectKey}</strong>. Start
            with read-only actions and add write actions only when this project needs
            them.
          </Dialog.Description>
          <form
            className={styles.connectionForm}
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <label htmlFor={`connector-${target.id}-account`}>Account or workspace</label>
            <Input
              id={`connector-${target.id}-account`}
              required
              maxLength={500}
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              disabled={busy}
              placeholder="Domain, tenant, workspace, portal, or account ID"
            />
            <label htmlFor={`connector-${target.id}-credential`}>
              {credentialLabel(target.authenticationType)}
            </label>
            <Input
              id={`connector-${target.id}-credential`}
              type="password"
              required
              maxLength={12000}
              autoComplete="off"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              disabled={busy}
            />
            <label htmlFor={`connector-${target.id}-resource`}>
              Resource scope{" "}
              <span className="font-normal text-m-text-muted">(optional)</span>
            </label>
            <Input
              id={`connector-${target.id}-resource`}
              maxLength={500}
              value={resource}
              onChange={(event) => setResource(event.target.value)}
              disabled={busy}
              placeholder="Repository, domain, index, site, or default"
            />
            <fieldset className="mt-2 space-y-2">
              <legend className="text-sm font-semibold text-m-text">
                Enable actions
              </legend>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-m-border p-3">
                {target.actions.map((action) => (
                  <label
                    key={action.id}
                    className="flex cursor-pointer items-start gap-2 text-sm font-normal text-m-text"
                  >
                    <input
                      type="checkbox"
                      checked={actions.includes(action.id)}
                      onChange={() => toggle(action.id)}
                      disabled={busy}
                      className="mt-0.5"
                    />
                    <span>
                      {action.name}
                      <span className="ml-2 text-xs text-m-text-muted">
                        {action.readOnly ? "Read only" : "Write"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className={styles.muted}>
              Connection Hub validates and encrypts the credential. It is never returned
              to this screen. An approved connector release is required before actions can
              be enabled.
            </p>
            {error && (
              <p role="alert" className={styles.fileError}>
                {error}
              </p>
            )}
            <div className={styles.dialogActions}>
              <Button
                type="submit"
                disabled={busy || !account.trim() || !credential || actions.length === 0}
              >
                {busy ? "Connecting…" : `Connect ${target.name}`}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
