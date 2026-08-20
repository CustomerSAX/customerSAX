"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Icon, PageHeader, SearchBar, Table } from "@csa/ui";
import type { AgentPresence, AgentPresenceStatus } from "@/features/csa-assistant/hooks/use-agent-presence";

function statusVariant(status: AgentPresenceStatus) {
  if (status === "online") return "success" as const;
  if (status === "away") return "warning" as const;
  return "neutral" as const;
}

function formatDateTime(value: string | null): string {
  if (!value) return "--";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "--";
  }
}

export function AgentsView() {
  const [agents, setAgents] = useState<AgentPresence[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/presence/agents", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { agents?: AgentPresence[] };
      setAgents(Array.isArray(payload.agents) ? payload.agents : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAgents();
    });
    const interval = window.setInterval(() => void loadAgents(), 30_000);

    return () => window.clearInterval(interval);
  }, [loadAgents]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) =>
      [agent.name, agent.email, agent.role, agent.status]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [agents, search]);

  const onlineCount = agents.filter((agent) => agent.status === "online").length;
  const awayCount = agents.filter((agent) => agent.status === "away").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        subtitle="Search support agents, review availability, and monitor recent login activity."
        badge={<Badge variant="primary">Operations</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="success" appearance="subtle" dot>{onlineCount} online</Badge>
            {awayCount > 0 && <Badge variant="warning" appearance="subtle" dot>{awayCount} away</Badge>}
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="refresh-cw" size="xs" />}
              onClick={() => void loadAgents()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <Card variant="default" className="p-4">
        <SearchBar
          aria-label="Search agents"
          value={search}
          onChange={(value) => setSearch(value)}
          onClear={() => setSearch("")}
          placeholder="Search agents by name, email, role, or status..."
        />
      </Card>

      {error ? (
        <div className="rounded-m-lg border border-m-error/30 bg-m-error/5 p-4 text-sm text-m-error">
          Failed to load agents: {error}
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Agent</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Role</Table.Head>
              <Table.Head>Last Logged In</Table.Head>
              <Table.Head>Last Seen</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={5} className="py-8 text-center text-m-text-muted">
                  Loading agents...
                </Table.Cell>
              </Table.Row>
            ) : filteredAgents.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5} className="py-8 text-center text-m-text-muted">
                  No agents match your search.
                </Table.Cell>
              </Table.Row>
            ) : (
              filteredAgents.map((agent) => (
                <Table.Row key={agent.email}>
                  <Table.Cell>
                    <div className="flex min-w-0 flex-col">
                      <span className="font-semibold text-m-text">{agent.name || agent.email}</span>
                      <span className="text-m-text-muted">{agent.email}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={statusVariant(agent.status)} appearance="subtle" dot>
                      {agent.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="capitalize">{agent.role}</Table.Cell>
                  <Table.Cell>{formatDateTime(agent.lastLoggedInAt)}</Table.Cell>
                  <Table.Cell>{formatDateTime(agent.lastSeenAt)}</Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
