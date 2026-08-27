"use client";

import { useEffect, useMemo, useState } from "react";

export type AgentPresenceStatus = "away" | "offline" | "online";

export type AgentPresence = {
  email: string;
  lastSeenAt?: string;
  status: AgentPresenceStatus;
};

type UseAgentPresenceOptions = {
  heartbeat?: boolean;
  intervalMs?: number;
};

type AgentRegistryUser = {
  email?: string;
};

const OFFLINE_STATUS: AgentPresenceStatus = "offline";

export function useAgentPresence({ heartbeat = true, intervalMs = 60_000 }: UseAgentPresenceOptions = {}) {
  const [presence, setPresence] = useState<AgentPresence[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const loadPresence = async () => {
      try {
        const res = await fetch("/api/agent-registry/users", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as { users?: AgentRegistryUser[] };
        if (cancelled) return;

        setPresence(
          (data.users ?? [])
            .map((user) => user.email?.trim().toLowerCase())
            .filter((email): email is string => Boolean(email))
            .map((email) => ({ email, status: OFFLINE_STATUS }))
        );
      } catch {
        if (!cancelled) setPresence([]);
      }
    };

    void loadPresence();
    if (heartbeat) {
      timer = setInterval(() => void loadPresence(), intervalMs);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [heartbeat, intervalMs]);

  const statusByEmail = useMemo(() => {
    return new Map(presence.map((agent) => [agent.email, agent]));
  }, [presence]);

  return { presence, statusByEmail };
}
