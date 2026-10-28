"use client";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileText, Folder, Link2, Search, X } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";
import { getProviderLogo } from "@/features/onboarding/components/ProviderLogo";
import styles from "./assistant-integrations.module.css";
import { ZendeskPluginDialog, useZendeskPluginStatus } from "./ZendeskPluginDialog";
import { AlgoliaPluginDialog, useAlgoliaPluginStatus } from "./AlgoliaPluginDialog";
type Connector = { id: string; name: string; description: string };
export type AssistantAttachment = { id: string; name: string; text: string };
export function AssistantIntegrations({
  disabled,
  attachments,
  setAttachments,
  onPrompt
}: {
  disabled: boolean;
  attachments: AssistantAttachment[];
  setAttachments: Dispatch<SetStateAction<AssistantAttachment[]>>;
  onPrompt: (text: string) => void;
}) {
  const { user } = useCurrentUser();
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [zendeskOpen, setZendeskOpen] = useState(false);
  const [algoliaOpen, setAlgoliaOpen] = useState(false);
  const algolia = useAlgoliaPluginStatus(
    user?.activeClientId,
    user?.activeProjectKey,
    pluginsOpen
  );
  const [search, setSearch] = useState("");
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const admin = user?.role === "admin" || user?.role === "superadmin";
  const queryClient = useQueryClient();
  const zendesk = useZendeskPluginStatus(
    user?.activeClientId,
    user?.activeProjectKey,
    pluginsOpen
  );
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [removedScope, setRemovedScope] = useState("");
  const scopeKey = `${user?.activeClientId}:${user?.activeProjectKey}`;
  const catalog = useQuery<Connector[]>({
    queryKey: ["assistant-plugin-catalog", user?.activeClientId, user?.activeProjectKey],
    enabled: pluginsOpen && admin,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/connection-hub/connectors", {
        signal,
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Unable to load plugins");
      const payload = await response.json();
      if (
        payload?.ok !== true ||
        !Array.isArray(payload.connectors) ||
        !payload.connectors.every(
          (c: Connector) =>
            c &&
            typeof c.id === "string" &&
            typeof c.name === "string" &&
            typeof c.description === "string"
        )
      )
        throw new Error("Invalid catalog");
      return payload.connectors;
    },
    staleTime: 30_000,
    retry: false
  });
  const visible = (catalog.data ?? []).filter(
    (c) =>
      !(c.id === "zendesk" && zendesk.data?.connected) &&
      !(c.id === "algolia" && algolia.data?.selected) &&
      `${c.name} ${c.description}`.toLowerCase().includes(search.toLowerCase())
  );

  async function removeZendesk() {
    if (!admin || removing || !user?.activeClientId || !user.activeProjectKey) return;
    const { activeClientId: clientId, activeProjectKey: projectKey } = user;
    setRemoving(true);
    setRemoveError("");
    try {
      const response = await fetch("/api/connection-hub/zendesk", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, projectKey })
      });
      const data = await response.json();
      if (
        !response.ok ||
        data.ok !== true ||
        data.connected !== false ||
        data.projectKey !== projectKey
      )
        throw new Error(data.error || "Unable to remove Zendesk. Please try again.");
      await queryClient.cancelQueries({
        queryKey: ["zendesk-plugin-status", clientId, projectKey]
      });
      queryClient.setQueryData(["zendesk-plugin-status", clientId, projectKey], data);
      setRemovedScope(`${clientId}:${projectKey}`);
    } catch (error) {
      setRemoveError(
        error instanceof Error
          ? error.message
          : "Unable to remove Zendesk. Please try again."
      );
    } finally {
      setRemoving(false);
    }
  }

  async function readFiles(files: FileList | null) {
    if (!files) return;
    setFileError("");
    const selected = Array.from(files);
    if (
      selected.length + attachments.length > 3 ||
      selected.some(
        (file) => file.size > 32_000 || !/\.(txt|md|csv|json)$/i.test(file.name)
      )
    ) {
      setFileError(
        "Choose up to 3 text, Markdown, CSV, or JSON files, each under 32 KB."
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setReading(true);
    try {
      const next = await Promise.all(
        selected.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          text: await file.text()
        }))
      );
      setAttachments((current) => [...current, ...next]);
    } catch {
      setFileError("That file could not be read. Please try again.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={styles.integrations}>
      <div className={styles.toolbar}>
        <button
          type="button"
          onClick={() => {
            const select = document.querySelector<HTMLSelectElement>(
              ".csa-topbar-project select"
            );
            select?.focus();
            if (select && "showPicker" in select) {
              try {
                select.showPicker();
              } catch {
                /* Focus remains on the native selector. */
              }
            }
          }}
        >
          <Folder size={19} />
          <span className={styles.projectName}>
            {user?.projects.find(
              (project) =>
                project.projectKey === user.activeProjectKey &&
                project.clientId === user.activeClientId
            )?.displayName ||
              user?.activeProjectKey ||
              "Choose project"}
          </span>
        </button>
        <button
          type="button"
          disabled={reading || disabled}
          onClick={() => fileRef.current?.click()}
        >
          <FileText size={19} />
          Files{attachments.length > 0 && ` (${attachments.length})`}
        </button>
        <Popover.Root open={pluginsOpen} onOpenChange={setPluginsOpen}>
          <Popover.Trigger asChild>
            <button type="button" className={pluginsOpen ? styles.selected : ""}>
              <Link2 size={19} />
              Plugins
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              aria-label="Plugins"
              className={styles.popover}
              align="start"
              sideOffset={10}
              collisionPadding={12}
            >
              <div className={styles.search}>
                <Search size={18} />
                <input
                  aria-label="Search plugins"
                  placeholder="Search plugins…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              {zendesk.data?.connected && (
                <>
                  <p className={styles.caption}>SELECTED CONNECTORS</p>
                  <div className={styles.selectedConnector}>
                    <button
                      type="button"
                      className={styles.pluginRow}
                      onClick={() => {
                        setPluginsOpen(false);
                        setZendeskOpen(true);
                      }}
                    >
                      <span className={styles.pluginLogo}>
                        {getProviderLogo("zendesk", "h-5 w-5")}
                      </span>
                      <span>Zendesk</span>
                    </button>
                    {admin && (
                      <button
                        type="button"
                        className={styles.removeConnector}
                        disabled={removing}
                        onClick={() => void removeZendesk()}
                      >
                        {removing ? "Removing…" : "Remove connector"}
                      </button>
                    )}
                  </div>
                </>
              )}
              {algolia.data?.selected && (
                <>
                  <p className={styles.caption}>SELECTED PRODUCT CONNECTOR</p>
                  <button
                    type="button"
                    className={styles.pluginRow}
                    onClick={() => {
                      setPluginsOpen(false);
                      setAlgoliaOpen(true);
                    }}
                  >
                    <span className={styles.pluginLogo}>
                      {getProviderLogo("algolia", "h-5 w-5")}
                    </span>
                    <span>
                      Algolia{algolia.data.incomplete ? " · Setup incomplete" : ""}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
              {algolia.isError && (
                <p role="alert" className={styles.fileError}>
                  Algolia status is unavailable. Reopen Plugins to retry.
                </p>
              )}
              {removeError && (
                <p role="alert" className={styles.fileError}>
                  {removeError}
                </p>
              )}
              {!zendesk.data?.connected && removedScope === scopeKey && (
                <p role="status" className={styles.muted}>
                  Zendesk removed. You can connect it again below.
                </p>
              )}
              <p className={styles.caption}>AVAILABLE IN CONNECTION HUB</p>
              {!admin ? (
                <p className={styles.muted}>
                  Ask an administrator to connect and manage plugins for your
                  organization.
                </p>
              ) : catalog.isPending ? (
                <p className={styles.muted} role="status">
                  Loading plugins…
                </p>
              ) : catalog.isError ? (
                <div role="alert">
                  <p className={styles.muted}>The plugin catalog is unavailable.</p>
                  <button
                    type="button"
                    className={styles.retry}
                    onClick={() => void catalog.refetch()}
                  >
                    Try again
                  </button>
                </div>
              ) : visible.length === 0 ? (
                <p className={styles.muted}>
                  {search
                    ? "No plugins match your search."
                    : zendesk.data?.connected
                      ? "No additional plugins are available in the catalog."
                      : "No plugins are available in the catalog yet."}
                </p>
              ) : (
                <div className={styles.pluginList}>
                  {visible.map((connector) =>
                    ["zendesk", "algolia"].includes(connector.id) ? (
                      <button
                        key={connector.id}
                        type="button"
                        className={styles.pluginRow}
                        title={connector.description}
                        onClick={() => {
                          setPluginsOpen(false);
                          if (connector.id === "algolia") setAlgoliaOpen(true);
                          else setZendeskOpen(true);
                        }}
                      >
                        <span className={styles.pluginLogo}>
                          {getProviderLogo(connector.id, "h-5 w-5")}
                        </span>
                        <span>{connector.name}</span>
                        <ChevronRight size={16} />
                      </button>
                    ) : (
                      <Link
                        key={connector.id}
                        href="/admin-settings/connection-hub"
                        className={styles.pluginRow}
                        title={connector.description}
                      >
                        <span className={styles.pluginLogo}>
                          {getProviderLogo(connector.id, "h-5 w-5") ?? (
                            <Link2 size={20} />
                          )}
                        </span>
                        <span>{connector.name}</span>
                        <ChevronRight size={16} />
                      </Link>
                    )
                  )}
                </div>
              )}
              {admin && (
                <Link className={styles.browse} href="/admin-settings/connection-hub">
                  <Link2 size={18} />
                  Connect plugins
                  <ChevronRight size={17} />
                </Link>
              )}
              <Popover.Arrow className={styles.arrow} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {zendeskOpen && user?.activeProjectKey && user.activeClientId && (
        <ZendeskPluginDialog
          key={`${user.activeClientId}:${user.activeProjectKey}`}
          projectKey={user.activeProjectKey}
          clientId={user.activeClientId}
          admin={admin}
          onClose={() => setZendeskOpen(false)}
          onPrompt={onPrompt}
        />
      )}
      {algoliaOpen && user?.activeClientId && user.activeProjectKey && (
        <AlgoliaPluginDialog
          key={`algolia:${user.activeClientId}:${user.activeProjectKey}`}
          clientId={user.activeClientId}
          projectKey={user.activeProjectKey}
          admin={admin}
          onClose={() => setAlgoliaOpen(false)}
          onPrompt={onPrompt}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv,.json"
        multiple
        hidden
        onChange={(event) => void readFiles(event.target.files)}
      />
      {attachments.length > 0 && (
        <div className={styles.attachments}>
          {attachments.map((file) => (
            <span key={file.id}>
              <FileText size={14} />
              {file.name}
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((item) => item.id !== file.id)
                  )
                }
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      {attachments.length > 0 && (
        <p className={styles.note}>
          File contents will be included in your next message.
        </p>
      )}
      {fileError && (
        <p className={styles.fileError} role="alert">
          {fileError}
        </p>
      )}
    </div>
  );
}
