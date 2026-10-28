"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "@csa/ui";
import { X } from "lucide-react";
import styles from "./assistant-integrations.module.css";

function validStatus(
  value: unknown,
  clientId: string,
  projectKey: string
): value is Status {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true &&
    "clientId" in value &&
    value.clientId === clientId &&
    "projectKey" in value &&
    value.projectKey === projectKey &&
    "connected" in value &&
    typeof value.connected === "boolean" &&
    "selected" in value &&
    typeof value.selected === "boolean" &&
    "incomplete" in value &&
    typeof value.incomplete === "boolean" &&
    "indexName" in value &&
    (value.indexName === null || typeof value.indexName === "string")
  );
}

export function useAlgoliaPluginStatus(
  clientId: string | undefined,
  projectKey: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ["algolia-plugin-status", clientId, projectKey],
    enabled: enabled && !!clientId && !!projectKey,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/connection-hub/algolia", {
        signal,
        cache: "no-store"
      });
      const value: unknown = await response.json();
      if (
        !response.ok ||
        !clientId ||
        !projectKey ||
        !validStatus(value, clientId, projectKey)
      )
        throw new Error("Unable to check the Algolia connection.");
      return value;
    },
    retry: false,
    staleTime: 0
  });
}

export function AlgoliaPluginDialog({
  clientId,
  projectKey,
  admin,
  onClose,
  onPrompt
}: {
  clientId: string;
  projectKey: string;
  admin: boolean;
  onClose: () => void;
  onPrompt?: (text: string) => void;
}) {
  const [applicationId, setApplicationId] = useState("");
  const [indexName, setIndexName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = useAlgoliaPluginStatus(clientId, projectKey);
  const queryClient = useQueryClient();
  const router = useRouter();

  async function save(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/connection-hub/algolia", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          projectKey,
          ...(method === "POST"
            ? {
                applicationId: applicationId.trim(),
                indexName: indexName.trim(),
                apiKey: apiKey.trim()
              }
            : {})
        })
      });
      const value: unknown = await response.json();
      if (!response.ok || !validStatus(value, clientId, projectKey)) {
        const message =
          typeof value === "object" &&
          value !== null &&
          "error" in value &&
          typeof value.error === "string"
            ? value.error
            : "Unable to update Algolia. Refresh the connection status and retry.";
        throw new Error(message);
      }
      await queryClient.cancelQueries({
        queryKey: ["algolia-plugin-status", clientId, projectKey]
      });
      queryClient.setQueryData(["algolia-plugin-status", clientId, projectKey], value);
      await queryClient.invalidateQueries({
        queryKey: ["connection-hub-project-status", clientId, projectKey]
      });
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update Algolia.");
      await status.refetch();
    } finally {
      setApiKey("");
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          setApiKey("");
          onClose();
        }
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
              Algolia connector
            </Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Close Algolia connector">
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.muted}>
            Use Algolia through Connection Hub for Products and assistant product searches
            in <strong>{projectKey}</strong>. Removing it restores your saved native
            product provider.
          </Dialog.Description>
          {status.isPending ? (
            <p role="status">Checking connection…</p>
          ) : status.isError ? (
            <div role="alert">
              <p>{status.error.message}</p>
              <Button variant="outline" onClick={() => void status.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <p role="status" className={styles.connectionStatus}>
                {status.data.incomplete
                  ? "Setup incomplete. Reconnect Algolia or remove it to restore Native."
                  : status.data.connected
                    ? `Connected to ${status.data.indexName} · Search and browse enabled`
                    : "Not selected · Using the saved native provider"}
              </p>
              {status.data.connected && onPrompt && (
                <Button
                  onClick={() => {
                    onPrompt("Search products using Algolia.");
                    onClose();
                  }}
                >
                  Try in chat
                </Button>
              )}
              {admin ? (
                <form
                  className={styles.connectionForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save("POST");
                  }}
                >
                  <p className={styles.muted}>
                    {status.data.selected
                      ? "Replace this project's Algolia connection"
                      : "Connect your Algolia index"}
                  </p>
                  <label htmlFor="plugin-algolia-application">Application ID</label>
                  <Input
                    id="plugin-algolia-application"
                    required
                    pattern="[A-Za-z0-9]+"
                    maxLength={63}
                    value={applicationId}
                    onChange={(event) => setApplicationId(event.target.value)}
                    disabled={busy}
                  />
                  <label htmlFor="plugin-algolia-index">Index name</label>
                  <Input
                    id="plugin-algolia-index"
                    required
                    pattern="[A-Za-z0-9_-]+"
                    maxLength={100}
                    value={indexName}
                    onChange={(event) => setIndexName(event.target.value)}
                    disabled={busy}
                  />
                  <label htmlFor="plugin-algolia-key">Read-only API key</label>
                  <Input
                    id="plugin-algolia-key"
                    type="password"
                    required
                    maxLength={12000}
                    autoComplete="off"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    disabled={busy}
                  />
                  <p className={styles.muted}>
                    Use an index-restricted key with search and browse permissions.
                    Connection Hub validates and encrypts it. Saved credentials are never
                    sent back to this form.
                  </p>
                  <div className={styles.dialogActions}>
                    <Button
                      type="submit"
                      disabled={
                        busy ||
                        !applicationId.trim() ||
                        !indexName.trim() ||
                        !apiKey.trim()
                      }
                    >
                      {busy
                        ? "Saving…"
                        : status.data.selected
                          ? "Replace connection"
                          : "Connect Algolia"}
                    </Button>
                    {status.data.selected && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void save("DELETE")}
                      >
                        Remove connector
                      </Button>
                    )}
                  </div>
                  <p className={styles.muted}>
                    This selection enables read actions only. Your native provider
                    settings remain saved.
                  </p>
                </form>
              ) : (
                <p className={styles.muted}>
                  An administrator manages this project’s connection.
                </p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className={styles.fileError}>
              {error}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Status = {
  ok: true;
  clientId: string;
  projectKey: string;
  connected: boolean;
  selected: boolean;
  incomplete: boolean;
  indexName: string | null;
};
