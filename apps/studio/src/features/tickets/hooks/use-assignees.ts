"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

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
  const { data: agents = [], isLoading } = useQuery<AssigneeOption[]>({
    queryKey: ["agentRegistryUsers"],
    queryFn: async () => {
      const response = await fetch("/api/agent-registry/users");
      if (!response.ok) throw new Error(`Agent registry returned ${response.status}`);
      const data = (await response.json()) as AgentRegistryResponse;
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
      return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
    },
    staleTime: 10 * 60 * 1000, // 10 minutes team list cache
  });

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
