"use client";

import { useEffect, useMemo, useState } from "react";

export interface AssigneeOption {
  value: string;
  label: string;
}

interface AgentRegistryResponse {
  users?: Array<{ id?: string; name?: string; email?: string }>;
}

const SELECT_AGENT_OPTION: AssigneeOption = {
  value: "",
  label: "Select an agent",
};

export function useAssignees(currentAssignee?: string | null) {
  const [agents, setAgents] = useState<AssigneeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/agent-registry/users", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Agent registry returned ${response.status}`);
        return response.json() as Promise<AgentRegistryResponse>;
      })
      .then((data) => {
        const unique = new Map<string, AssigneeOption>();
        for (const user of data.users ?? []) {
          const email = user.email?.trim();
          if (!email) continue;
          const name = user.name?.trim();
          unique.set(email.toLowerCase(), {
            value: email,
            label: name && name.toLowerCase() !== email.toLowerCase() ? `${name} (${email})` : email,
          });
        }
        setAgents([...unique.values()].sort((a, b) => a.label.localeCompare(b.label)));
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Failed to load ticket assignees", error);
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const options = useMemo(() => {
    const result = [SELECT_AGENT_OPTION, ...agents];
    const current = currentAssignee?.trim();
    if (current && !result.some((option) => option.value === current)) {
      result.push({ value: current, label: current });
    }
    return result;
  }, [agents, currentAssignee]);

  return { options, isLoading };
}
