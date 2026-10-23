"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Icon, Input } from "@csa/ui";
import { useCurrentUser } from "@/lib/use-current-user";
import { getProviderLogo } from "@/features/onboarding/components/ProviderLogo";
import type { HubCatalogConnector } from "@/lib/connection-hub-catalog";

export function ConnectionHubCatalogView() {
  const { user } = useCurrentUser();
  const [search, setSearch] = useState("");
  const allowed = user?.role === "admin" || user?.role === "superadmin";
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
  const term = search.trim().toLowerCase();
  const visible = all.filter((item) =>
    `${item.name} ${item.description} ${item.category} ${item.actions.map((action) => action.name).join(" ")}`
      .toLowerCase()
      .includes(term)
  );
  if (!allowed) return <p>Administrator access is required.</p>;
  return (
    <section aria-label="Connection Hub connectors" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-m-text">Connection Hub</h2>
          <p className="mt-1 text-sm text-m-text-muted">
            Explore the connectors and actions available from Connection Hub.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={catalog.isFetching}
          onClick={() => void catalog.refetch()}
        >
          <Icon name="refresh-cw" size="xs" className="mr-2" />
          {catalog.isFetching ? "Refreshing…" : "Refresh"}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-full max-w-md">
              <Input
                aria-label="Search Connection Hub connectors"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search connectors or actions…"
              />
            </div>
            <p className="text-sm text-m-text-muted">
              {all.length} connectors ·{" "}
              {all.reduce((count, item) => count + item.actions.length, 0)} actions
            </p>
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-sm text-m-text-muted">
              No connectors match your search.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <Card
                  key={item.id}
                  className="min-w-0 space-y-4 border border-m-border bg-m-surface p-5 shadow-m-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-m-border bg-m-surface-subtle">
                      {getProviderLogo(item.id, "h-6 w-6") ?? (
                        <Icon name="link" size="sm" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-m-text">{item.name}</h3>
                      <p className="break-words text-xs text-m-text-muted">
                        {item.category}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-m-text-muted">{item.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral" size="sm">
                      {item.actions.length} actions
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {item.authenticationType.replace(/_/g, " ")}
                    </Badge>
                  </div>
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
                          {action.readOnly && (
                            <span className="shrink-0 text-xs text-m-text-muted">
                              Read only
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
