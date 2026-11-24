"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Icon, Input } from "@csa/ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  ConnectorMonogram,
  getProviderLogo
} from "@/features/onboarding/components/ProviderLogo";
import type { HubCatalogConnector } from "@/lib/connection-hub-catalog";
import { ZendeskPluginDialog } from "@/features/csa-assistant/components/ZendeskPluginDialog";
import { RemoveConnectorDialog, type RemovalTarget } from "./RemoveConnectorDialog";
import { ConnectConnectorDialog, type ConnectionTarget } from "./ConnectConnectorDialog";
import { PreviewConnectorDialog } from "./PreviewConnectorDialog";

import {
  AlgoliaPluginDialog,
  useAlgoliaPluginStatus
} from "@/features/csa-assistant/components/AlgoliaPluginDialog";

export function ConnectionHubCatalogView() {
  const { user } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [algoliaOpen, setAlgoliaOpen] = useState(false);
  const [zendeskOpen, setZendeskOpen] = useState(false);
  const [removal, setRemoval] = useState<RemovalTarget | null>(null);
  const [connection, setConnection] = useState<ConnectionTarget | null>(null);
  const [preview, setPreview] = useState<HubCatalogConnector | null>(null);
  const [notice, setNotice] = useState<{
    clientId: string;
    projectKey: string;
    text: string;
  } | null>(null);
  const allowed = user?.role === "admin" || user?.role === "superadmin";
  const algolia = useAlgoliaPluginStatus(
    user?.activeClientId,
    user?.activeProjectKey,
    allowed
  );
  const projectStatus = useQuery({
    queryKey: [
      "connection-hub-project-status",
      user?.activeClientId,
      user?.activeProjectKey
    ],
    enabled: allowed && !!user?.activeClientId && !!user.activeProjectKey,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/connection-hub/status", {
        cache: "no-store",
        signal
      });
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !record(payload) ||
        payload.ok !== true ||
        payload.projectKey !== user?.activeProjectKey ||
        payload.clientId !== user?.activeClientId ||
        !Array.isArray(payload.bindings) ||
        !payload.bindings.every(
          (item: unknown) =>
            record(item) &&
            typeof item.connectorId === "string" &&
            typeof item.operation === "string" &&
            typeof item.enabled === "boolean"
        )
      )
        throw new Error("Unable to check connector status.");
      return payload.bindings as {
        connectorId: string;
        operation: string;
        enabled: boolean;
      }[];
    },
    retry: false,
    staleTime: 30000
  });
  const catalog = useQuery({
    queryKey: ["connection-hub-catalog", user?.activeClientId || user?.organization?.id],
    enabled: allowed,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/connection-hub/connectors", {
        credentials: "same-origin",
        cache: "no-store",
        signal
      });
      if (!response.ok) throw new Error("Unable to load Connection Hub connectors.");
      const payload: unknown = await response.json();
      if (!record(payload) || payload.ok !== true || !connectors(payload.connectors))
        throw new Error("Unable to load Connection Hub connectors.");
      return payload.connectors;
    },
    retry: false,
    staleTime: 30000
  });
  const all = catalog.data ?? [];
  const categories = Array.from(
    all.reduce((counts, item) => {
      const category = categoryLabel(item.category);
      counts.set(category, (counts.get(category) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const selectedCategorySet = new Set(selectedCategories);
  const term = search.trim().toLowerCase();
  const visible = all.filter(
    (item) =>
      (selectedCategorySet.size === 0 ||
        selectedCategorySet.has(categoryLabel(item.category))) &&
      `${item.name} ${item.description} ${item.category} ${item.actions.map((action) => action.name).join(" ")}`
        .toLowerCase()
        .includes(term)
  );

  function toggleCategory(category: string) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  }
  if (!allowed) return <p>Administrator access is required.</p>;
  return (
    <section aria-label="Connection Hub connectors" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-m-text">Connection Hub</h2>
          <p className="mt-1 text-sm text-m-text-muted">
            Connectors and enabled actions for{" "}
            {user?.activeProjectKey || "the selected project"}.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={catalog.isFetching || projectStatus.isFetching}
          onClick={() => {
            void catalog.refetch();
            void algolia.refetch();
            if (user?.activeProjectKey && user.activeClientId)
              void projectStatus.refetch();
          }}
        >
          <Icon name="refresh-cw" size="xs" className="mr-2" />
          {catalog.isFetching || projectStatus.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {catalog.isPending ? (
        <p
          role="status"
          className="rounded-xl border border-m-border p-8 text-sm text-m-text-muted"
        >
          Loading Connection Hub connectors…
        </p>
      ) : catalog.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-m-border bg-m-surface p-6"
        >
          <p className="text-sm text-m-text">Unable to load Connection Hub connectors.</p>
          <Button variant="outline" onClick={() => void catalog.refetch()}>
            Retry
          </Button>
        </div>
      ) : all.length === 0 ? (
        <p className="rounded-xl border border-m-border p-8 text-sm text-m-text-muted">
          No connectors are available in this Connection Hub catalog.
        </p>
      ) : (
        <>
          <p className="text-xs text-m-text-muted">
            Remove any enabled connector from this project using its card. Enabled badges
            show configured actions, not credential health. Native capabilities are listed
            in the Native Connectors tab.
          </p>
          {notice?.clientId === user?.activeClientId &&
            notice?.projectKey === user?.activeProjectKey && (
              <p role="status" className="text-sm text-m-text">
                {notice?.text}
              </p>
            )}
          {projectStatus.isError && (
            <p role="alert" className="text-sm text-m-text-muted">
              Project status is unavailable. The catalog below is still available; click
              Refresh to retry.
            </p>
          )}
          <div
            className={`grid items-start gap-4 transition-[grid-template-columns] duration-200 ${
              filtersCollapsed
                ? "lg:grid-cols-[64px_minmax(0,1fr)]"
                : "lg:grid-cols-[240px_minmax(0,1fr)]"
            }`}
          >
            <aside className="overflow-hidden rounded-xl border border-m-border bg-m-surface shadow-m-card lg:sticky lg:top-4">
              <button
                type="button"
                aria-expanded={!filtersCollapsed}
                aria-controls="connector-category-filters"
                aria-label={
                  filtersCollapsed
                    ? "Expand connector filters"
                    : "Collapse connector filters"
                }
                className={`flex min-h-12 w-full items-center gap-2 text-sm font-semibold text-m-text transition-colors hover:bg-m-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-primary ${
                  filtersCollapsed
                    ? "justify-center px-2"
                    : "justify-between border-b border-m-border px-4"
                }`}
                onClick={() => setFiltersCollapsed((current) => !current)}
              >
                {!filtersCollapsed && <span>Filters</span>}
                {filtersCollapsed ? (
                  <PanelLeftOpen size={18} aria-hidden="true" />
                ) : (
                  <span className="text-m-primary">
                    <PanelLeftClose size={18} aria-hidden="true" />
                  </span>
                )}
              </button>
              {!filtersCollapsed && (
                <div id="connector-category-filters" className="space-y-2 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-m-text-muted">
                    Category
                  </p>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-m-text hover:bg-m-surface-subtle">
                    <input
                      type="checkbox"
                      checked={selectedCategories.length === 0}
                      onChange={() => setSelectedCategories([])}
                      className="h-4 w-4 rounded border-m-border accent-m-primary"
                    />
                    <span className="min-w-0 flex-1">All categories</span>
                    <span className="text-xs tabular-nums text-m-text-muted">
                      {all.length}
                    </span>
                  </label>
                  {categories.map((category) => (
                    <label
                      key={category.name}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-m-text hover:bg-m-surface-subtle"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategorySet.has(category.name)}
                        onChange={() => toggleCategory(category.name)}
                        className="h-4 w-4 rounded border-m-border accent-m-primary"
                      />
                      <span className="min-w-0 flex-1 break-words">{category.name}</span>
                      <span className="text-xs tabular-nums text-m-text-muted">
                        {category.count}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </aside>
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-full max-w-xl">
                  <Input
                    aria-label="Search Connection Hub connectors"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search connectors or actions…"
                  />
                </div>
                <p className="text-sm text-m-text-muted">
                  Showing {visible.length} of {all.length} connectors
                </p>
              </div>
              {visible.length === 0 ? (
                <div className="rounded-xl border border-m-border bg-m-surface p-8 text-center">
                  <p className="text-sm font-medium text-m-text">
                    No connectors match these filters.
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-m-primary hover:underline"
                    onClick={() => {
                      setSearch("");
                      setSelectedCategories([]);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {visible.map((item) => {
                    const isPreview = item.availability === "preview";
                    const isActivePreview = isPreview && item.id === "commercetools";
                    const bindings = (projectStatus.data ?? []).filter(
                      (binding) => binding.connectorId === item.id
                    );
                    const selected = bindings.some((binding) => binding.enabled);
                    const enabled = new Set(
                      bindings
                        .filter(
                          (binding) =>
                            binding.enabled &&
                            item.actions.some((action) => action.id === binding.operation)
                        )
                        .map((binding) => binding.operation)
                    );
                    const known = projectStatus.isSuccess && !projectStatus.isError;
                    const label = isActivePreview
                      ? "Active"
                      : isPreview
                        ? "Preview"
                        : item.id === "algolia" && algolia.data?.incomplete
                          ? "Setup incomplete"
                          : !user?.activeProjectKey
                            ? "Select a project"
                            : projectStatus.isError
                              ? "Status unavailable"
                              : !known
                                ? "Checking status…"
                                : selected
                                  ? "Enabled"
                                  : bindings.length > 0
                                    ? "Disabled"
                                    : "Not connected";
                    return (
                      <Card
                        key={item.id}
                        className="min-w-0 space-y-4 border border-m-border bg-m-surface p-5 shadow-m-card"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-m-border bg-m-surface-subtle">
                            {getProviderLogo(item.id, "h-6 w-6") ?? (
                              <ConnectorMonogram name={item.name} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-m-text">{item.name}</h3>
                            <p className="break-words text-xs text-m-text-muted">
                              {categoryLabel(item.category)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              isActivePreview
                                ? "success"
                                : isPreview
                                  ? "neutral"
                                  : known && selected
                                    ? "success"
                                    : projectStatus.isError ||
                                        (known && bindings.length > 0)
                                      ? "warning"
                                      : "neutral"
                            }
                            dot
                            size="sm"
                          >
                            {label}
                          </Badge>
                        </div>
                        {known && !isPreview ? (
                          <p className="text-xs text-m-text-muted">
                            {enabled.size} of {item.actions.length} actions enabled for
                            this project
                          </p>
                        ) : null}
                        <p className="text-sm text-m-text-muted">{item.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="neutral" size="sm">
                            {item.actions.length} actions
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            {authenticationLabel(item.authenticationType)}
                          </Badge>
                        </div>
                        {(isPreview ||
                          item.id === "algolia" ||
                          item.id === "zendesk" ||
                          known) && (
                          <div className="flex flex-wrap items-center gap-3">
                            {isPreview && (
                              <Button variant="outline" onClick={() => setPreview(item)}>
                                View setup
                              </Button>
                            )}
                            {!isPreview && item.id === "algolia" && (
                              <Button
                                variant="outline"
                                disabled={!user?.activeClientId || !user.activeProjectKey}
                                onClick={() => setAlgoliaOpen(true)}
                              >
                                {algolia.data?.selected
                                  ? "Manage Algolia"
                                  : "Connect Algolia"}
                              </Button>
                            )}
                            {!isPreview && item.id === "zendesk" && (
                              <Button
                                variant="outline"
                                disabled={!user?.activeClientId || !user.activeProjectKey}
                                onClick={() => setZendeskOpen(true)}
                              >
                                {!known || selected
                                  ? "Manage Zendesk"
                                  : "Connect Zendesk"}
                              </Button>
                            )}
                            {!isPreview &&
                              item.id !== "algolia" &&
                              item.id !== "zendesk" &&
                              !selected && (
                                <Button
                                  variant="outline"
                                  disabled={
                                    !user?.activeClientId || !user.activeProjectKey
                                  }
                                  onClick={() => {
                                    if (!user?.activeClientId || !user.activeProjectKey)
                                      return;
                                    setConnection({
                                      ...item,
                                      clientId: user.activeClientId,
                                      projectKey: user.activeProjectKey
                                    });
                                  }}
                                >
                                  Connect {item.name}
                                </Button>
                              )}
                            {!isPreview && known && selected && (
                              <Button
                                variant="outline"
                                aria-label={`Remove ${item.name} connector`}
                                onClick={() => {
                                  if (!user?.activeClientId || !user.activeProjectKey)
                                    return;
                                  setNotice(null);
                                  setRemoval({
                                    connectorId: item.id,
                                    name: item.name,
                                    clientId: user.activeClientId,
                                    projectKey: user.activeProjectKey
                                  });
                                }}
                              >
                                <Icon name="trash-2" size="xs" className="mr-2" />
                                Remove connector
                              </Button>
                            )}
                          </div>
                        )}
                        <details className="border-t border-m-border pt-3">
                          <summary className="cursor-pointer text-sm font-medium text-m-primary">
                            View actions
                          </summary>
                          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-m-text">
                            {item.actions.map((action) => (
                              <li
                                key={action.id}
                                className="flex items-start justify-between gap-3"
                              >
                                <span className="min-w-0 break-words">{action.name}</span>
                                <span className="flex shrink-0 flex-wrap justify-end gap-2 text-xs text-m-text-muted">
                                  {action.readOnly && <span>Read only</span>}
                                  <Badge
                                    variant={
                                      isActivePreview ||
                                      (!isPreview && known && enabled.has(action.id))
                                        ? "success"
                                        : "neutral"
                                    }
                                    size="sm"
                                  >
                                    {isActivePreview
                                      ? "Active"
                                      : isPreview
                                        ? "Preview"
                                        : !known
                                          ? "Unknown"
                                          : enabled.has(action.id)
                                            ? "Enabled"
                                            : "Not enabled"}
                                  </Badge>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {algoliaOpen && user?.activeClientId && user.activeProjectKey && (
        <AlgoliaPluginDialog
          key={`algolia:${user.activeClientId}:${user.activeProjectKey}`}
          clientId={user.activeClientId}
          projectKey={user.activeProjectKey}
          admin={allowed}
          onClose={() => setAlgoliaOpen(false)}
        />
      )}
      {zendeskOpen && user?.activeClientId && user.activeProjectKey && (
        <ZendeskPluginDialog
          key={`zendesk:${user.activeClientId}:${user.activeProjectKey}`}
          clientId={user.activeClientId}
          projectKey={user.activeProjectKey}
          admin={allowed}
          projectWide
          onClose={() => setZendeskOpen(false)}
        />
      )}
      {removal &&
        removal.clientId === user?.activeClientId &&
        removal.projectKey === user?.activeProjectKey && (
          <RemoveConnectorDialog
            key={`${removal.clientId}:${removal.projectKey}:${removal.connectorId}`}
            target={removal}
            onClose={() => setRemoval(null)}
            onRemoved={(text) => {
              setNotice({
                clientId: removal.clientId,
                projectKey: removal.projectKey,
                text
              });
              setRemoval(null);
            }}
          />
        )}
      {connection &&
        connection.clientId === user?.activeClientId &&
        connection.projectKey === user?.activeProjectKey && (
          <ConnectConnectorDialog
            key={`${connection.clientId}:${connection.projectKey}:${connection.id}`}
            target={connection}
            onClose={() => setConnection(null)}
            onConnected={(text) => {
              setNotice({
                clientId: connection.clientId,
                projectKey: connection.projectKey,
                text
              });
              setConnection(null);
            }}
          />
        )}
      {preview && (
        <PreviewConnectorDialog
          key={preview.id}
          connector={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function categoryLabel(category: string) {
  const normalized = category.trim().toLowerCase();
  if (normalized === "search" || normalized === "search & merchandising") return "Search";
  return category;
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

function connectors(value: unknown): value is HubCatalogConnector[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        record(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        typeof item.category === "string" &&
        typeof item.authenticationType === "string" &&
        ["available", "preview"].includes(String(item.availability)) &&
        Array.isArray(item.actions) &&
        item.actions.every(
          (action: unknown) =>
            record(action) &&
            typeof action.id === "string" &&
            typeof action.name === "string" &&
            typeof action.readOnly === "boolean"
        )
    )
  );
}
