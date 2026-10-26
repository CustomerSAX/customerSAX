"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "@csa/ui";
import { X } from "lucide-react";
import styles from "./assistant-integrations.module.css";

type Status = {
  connected: boolean;
  subdomain: string | null;
  projectKey: string;
  clientId?: string;
  enabledActions?: number;
  incomplete?: boolean;
};
export function useZendeskPluginStatus(
  clientId: string | undefined,
  projectKey: string | undefined,
  enabled = true,
  projectWide = false
) {
  return useQuery<Status>({
    queryKey: [
      projectWide ? "zendesk-connector-status" : "zendesk-plugin-status",
      clientId,
      projectKey
    ],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/connection-hub/zendesk${projectWide ? "/connector" : ""}`,
        {
          signal,
          cache: "no-store"
        }
      );
      const data = await response.json();
      if (
        !response.ok ||
        data.ok !== true ||
        data.projectKey !== projectKey ||
        (projectWide &&
          (data.clientId !== clientId ||
            typeof data.enabledActions !== "number" ||
            typeof data.incomplete !== "boolean")) ||
        (data.subdomain !== null && typeof data.subdomain !== "string") ||
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
  onPrompt,
  projectWide = false
}: {
  projectKey: string;
  clientId: string;
  admin: boolean;
  onClose: () => void;
  onPrompt?: (text: string) => void;
  projectWide?: boolean;
}) {
  const [subdomain, setSubdomain] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const queryClient = useQueryClient();
  const status = useZendeskPluginStatus(clientId, projectKey, true, projectWide);
  const statusKey = [
    projectWide ? "zendesk-connector-status" : "zendesk-plugin-status",
    clientId,
    projectKey
  ];
  const account =
    projectWide && status.data?.subdomain ? status.data.subdomain : subdomain;

  async function save(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/connection-hub/zendesk${projectWide ? "/connector" : ""}`,
        {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectKey,
            clientId,
            ...(method === "POST"
              ? { subdomain: account.trim().toLowerCase(), accessToken: token.trim() }
              : {})
          })
        }
      );
      const data = await response.json();
      if (!response.ok || data.ok !== true)
        throw new Error(data.error || "Unable to update Zendesk connection.");
      if (
        data.projectKey !== projectKey ||
        typeof data.connected !== "boolean" ||
        (projectWide &&
          (data.clientId !== clientId ||
            typeof data.enabledActions !== "number" ||
            typeof data.incomplete !== "boolean"))
      )
        throw new Error("Invalid Zendesk connection response.");
      await queryClient.cancelQueries({ queryKey: statusKey });
      queryClient.setQueryData(statusKey, data);
      setConfirmRemove(false);
      setNotice(
        method === "DELETE"
          ? projectWide
            ? "Zendesk removed from this project."
            : "Zendesk removed from the assistant."
          : "Zendesk credentials saved."
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to update Zendesk connection."
      );
      await status.refetch();
    } finally {
      setToken("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["connection-hub-project-status", clientId, projectKey]
        }),
        queryClient.invalidateQueries({
          queryKey: [
            projectWide ? "zendesk-plugin-status" : "zendesk-connector-status",
            clientId,
            projectKey
          ]
        })
      ]);
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
            <Dialog.Title className="text-lg font-semibold">
              {projectWide ? "Manage Zendesk" : "Zendesk plugin"}
            </Dialog.Title>
            <Dialog.Close
              disabled={busy}
              aria-label={
                projectWide ? "Close Zendesk management" : "Close Zendesk plugin"
              }
            >
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.muted}>
            {projectWide ? (
              <>
                Update credentials or remove Zendesk actions in project{" "}
                <strong>{projectKey}</strong>.
              </>
            ) : (
              <>
                Search Zendesk tickets from CSA Assistant in project{" "}
                <strong>{projectKey}</strong>. Your selected ticketing provider stays
                unchanged.
              </>
            )}
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
                  ? "Setup incomplete. Update credentials to finish reconnecting Zendesk."
                  : status.data.connected
                    ? projectWide
                      ? `${status.data.subdomain || "Zendesk"} · ${status.data.enabledActions} actions enabled`
                      : `Connected to ${status.data.subdomain || "Zendesk"} · Ticket search enabled`
                    : "Not connected"}
              </p>
              {projectWide && (
                <p className={styles.muted}>
                  Enabled actions show project configuration. Saving a new token validates
                  it with Zendesk.
                </p>
              )}
              {status.data.connected && onPrompt && (
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
                      ? projectWide
                        ? "Update this project's Zendesk credentials"
                        : "Replace this project's plugin connection"
                      : "Connect your Zendesk account"}
                  </p>
                  <label htmlFor="plugin-zendesk-domain">Zendesk subdomain</label>
                  <Input
                    id="plugin-zendesk-domain"
                    required
                    pattern="[a-z0-9][a-z0-9-]*"
                    maxLength={63}
                    placeholder="your-company"
                    value={account}
                    onChange={(event) => setSubdomain(event.target.value)}
                    disabled={busy}
                    readOnly={projectWide && !!status.data.subdomain}
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
                    {projectWide
                      ? "Use a Zendesk OAuth token with permissions for your enabled actions."
                      : "Use an existing Zendesk OAuth token with ticket read access."}{" "}
                    Connection Hub validates and encrypts it. Automatic sign-in and token
                    refresh are not available yet.
                  </p>
                  {projectWide && (
                    <p className={styles.muted}>
                      Updating credentials keeps the same account and enabled actions.
                      Reconnecting a removed connector enables ticket reads and assistant
                      search. If Zendesk is your ticketing provider, removal stops Hub
                      ticket access; choose another provider to continue loading tickets.
                    </p>
                  )}
                  <div className={styles.dialogActions}>
                    <Button
                      type="submit"
                      disabled={busy || !token.trim() || !account.trim()}
                    >
                      {busy
                        ? "Saving…"
                        : status.data.connected
                          ? projectWide
                            ? "Update credentials"
                            : "Replace connection"
                          : "Connect Zendesk"}
                    </Button>
                    {status.data.connected && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          projectWide ? setConfirmRemove(true) : void save("DELETE")
                        }
                      >
                        Remove connector
                      </Button>
                    )}
                  </div>
                  {status.data.connected && (
                    <p className={styles.muted}>
                      {projectWide
                        ? "Remove disables every Zendesk action in this project. Shared accounts and the token in Zendesk stay active."
                        : "Remove disables Zendesk in this project’s assistant. It does not revoke the Zendesk token or affect other connections."}
                    </p>
                  )}
                  {projectWide && confirmRemove && status.data.connected && (
                    <div
                      role="group"
                      aria-label="Confirm Zendesk removal"
                      className={styles.connectionForm}
                    >
                      <p>
                        Remove Zendesk from <strong>{projectKey}</strong>? Its{" "}
                        {status.data.enabledActions} enabled actions will stop working
                        here, including ticket reads and assistant search when enabled.
                      </p>
                      <div className={styles.dialogActions}>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setConfirmRemove(false)}
                        >
                          Keep connector
                        </Button>
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => void save("DELETE")}
                        >
                          Remove from project
                        </Button>
                      </div>
                    </div>
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
          {notice && (
            <p role="status" className={styles.connectionStatus}>
              {notice}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
