"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "@csa/ui";
import { X } from "lucide-react";
import styles from "./assistant-integrations.module.css";

type Status = { connected: boolean; subdomain: string | null; projectKey: string };
export function useZendeskPluginStatus(
  clientId: string | undefined,
  projectKey: string | undefined,
  enabled = true
) {
  return useQuery<Status>({
    queryKey: ["zendesk-plugin-status", clientId, projectKey],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/connection-hub/zendesk", {
        signal,
        cache: "no-store"
      });
      const data = await response.json();
      if (
        !response.ok ||
        data.ok !== true ||
        data.projectKey !== projectKey ||
        typeof data.connected !== "boolean"
      )
        throw new Error(data.error || "Unable to check Zendesk connection.");
      return data;
    },
    enabled: enabled && !!clientId && !!projectKey,
    retry: false,
    staleTime: 0
  });
}
export function ZendeskPluginDialog({
  projectKey,
  clientId,
  admin,
  onClose,
  onPrompt
}: {
  projectKey: string;
  clientId: string;
  admin: boolean;
  onClose: () => void;
  onPrompt: (text: string) => void;
}) {
  const [subdomain, setSubdomain] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const status = useZendeskPluginStatus(clientId, projectKey);

  async function save(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/connection-hub/zendesk", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectKey,
          clientId,
          ...(method === "POST"
            ? { subdomain: subdomain.trim().toLowerCase(), accessToken: token.trim() }
            : {})
        })
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true)
        throw new Error(data.error || "Unable to update Zendesk connection.");
      if (data.projectKey !== projectKey || typeof data.connected !== "boolean")
        throw new Error("Invalid Zendesk connection response.");
      queryClient.setQueryData(["zendesk-plugin-status", clientId, projectKey], data);
      await status.refetch();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to update Zendesk connection."
      );
    } finally {
      setToken("");
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          setToken("");
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
            <Dialog.Title className="text-lg font-semibold">Zendesk plugin</Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Close Zendesk plugin">
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.muted}>
            Search Zendesk tickets from CSA Assistant in project{" "}
            <strong>{projectKey}</strong>. Your selected ticketing provider stays
            unchanged.
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
                {status.data.connected
                  ? `Connected to ${status.data.subdomain || "Zendesk"} · Ticket search enabled`
                  : "Not connected"}
              </p>
              {status.data.connected && (
                <Button
                  onClick={() => {
                    onPrompt("Search Zendesk for open tickets.");
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
                    {status.data.connected
                      ? "Replace this project's plugin connection"
                      : "Connect your Zendesk account"}
                  </p>
                  <label htmlFor="plugin-zendesk-domain">Zendesk subdomain</label>
                  <Input
                    id="plugin-zendesk-domain"
                    required
                    pattern="[a-z0-9][a-z0-9-]*"
                    maxLength={63}
                    placeholder="your-company"
                    value={subdomain}
                    onChange={(event) => setSubdomain(event.target.value)}
                    disabled={busy}
                  />
                  <label htmlFor="plugin-zendesk-token">OAuth access token</label>
                  <Input
                    id="plugin-zendesk-token"
                    type="password"
                    required
                    maxLength={12000}
                    autoComplete="off"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    disabled={busy}
                  />
                  <p className={styles.muted}>
                    Use an existing Zendesk OAuth token with ticket read access.
                    Connection Hub validates and encrypts it. Automatic sign-in and token
                    refresh are not available yet.
                  </p>
                  <div className={styles.dialogActions}>
                    <Button
                      type="submit"
                      disabled={busy || !token.trim() || !subdomain.trim()}
                    >
                      {busy
                        ? "Saving…"
                        : status.data.connected
                          ? "Replace connection"
                          : "Connect Zendesk"}
                    </Button>
                    {status.data.connected && (
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
                  {status.data.connected && (
                    <p className={styles.muted}>
                      Remove disables Zendesk in this project’s assistant. It does not
                      revoke the Zendesk token or affect other connections.
                    </p>
                  )}
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
