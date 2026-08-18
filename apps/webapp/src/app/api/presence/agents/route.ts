import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { authServiceUrl, currentSessionToken } from '@/app/api/auth/shared';

const AUTH_SERVICE_URL = authServiceUrl();
const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ??
  process.env.NEXT_PUBLIC_GRAPHQL_URL ??
  'http://localhost:4000/graphql';

const AGENT_CONTAINER = 'mc-user-info';

const AGENT_LIST_QUERY = `
  query GetAgentList($container: String!) {
    agentList(container: $container) {
      total
      results {
        id
        key
        email
      }
    }
  }
`;

type PresenceStatus = 'online' | 'away' | 'offline';

interface AgentUserGql {
  id: string;
  key: string;
  email: string;
}

interface AuthPresenceAgent {
  id: string;
  email: string;
  name: string;
  role: string;
  projectKey: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
  lastLoggedInAt: string | null;
  activeRoute: string | null;
  activeTicketId: string | null;
  tabCount: number;
}

interface PresenceAgent {
  id: string;
  key: string;
  email: string;
  name: string;
  role: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
  lastLoggedInAt: string | null;
  activeRoute: string | null;
  activeTicketId: string | null;
  tabCount: number;
}

async function fetchRegisteredAgents(): Promise<AgentUserGql[]> {
  const res = await fetch(BFF_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csa-commerce-platform': 'commercetools',
    },
    body: JSON.stringify({
      query: AGENT_LIST_QUERY,
      variables: { container: AGENT_CONTAINER },
    }),
    cache: 'no-store',
  });

  if (!res.ok) return [];

  const payload = await res.json().catch(() => null) as {
    data?: { agentList?: { results: AgentUserGql[] } };
    errors?: unknown[];
  } | null;

  if (payload?.errors?.length) return [];
  return payload?.data?.agentList?.results ?? [];
}

export async function GET() {
  try {
    const token = currentSessionToken();
    const user = await getCurrentUser();
    const projectKey = user?.activeProjectKey ?? user?.projectKey;

    if (!token || !user?.email || !projectKey) {
      return NextResponse.json({ agents: [], total: 0 }, { status: 401 });
    }

    const presenceUrl = new URL(`${AUTH_SERVICE_URL}/presence/agents`);
    presenceUrl.searchParams.set('projectKey', projectKey);

    const [registeredAgents, presenceResponse] = await Promise.all([
      fetchRegisteredAgents(),
      fetch(presenceUrl.toString(), {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      }).catch(() => null),
    ]);

    const authPayload = presenceResponse?.ok
      ? await presenceResponse.json().catch(() => null) as { agents?: AuthPresenceAgent[] } | null
      : null;
    const authByEmail = new Map(
      (authPayload?.agents ?? []).map((agent) => [agent.email.toLowerCase(), agent])
    );

    const merged: PresenceAgent[] = (authPayload?.agents ?? []).map((agent) => ({
      id: agent.id,
      key: agent.email,
      email: agent.email.toLowerCase(),
      name: agent.name || agent.email,
      role: agent.role,
      status: agent.status,
      lastSeenAt: agent.lastSeenAt,
      lastLoggedInAt: agent.lastLoggedInAt,
      activeRoute: agent.activeRoute,
      activeTicketId: agent.activeTicketId,
      tabCount: agent.tabCount,
    }));

    for (const agent of registeredAgents) {
      const email = agent.email.trim().toLowerCase();
      if (authByEmail.has(email) || merged.some((candidate) => candidate.email === email)) continue;
      merged.push({
        id: agent.id,
        key: agent.key,
        email,
        name: agent.email,
        role: 'agent',
        status: 'offline',
        lastSeenAt: null,
        lastLoggedInAt: null,
        activeRoute: null,
        activeTicketId: null,
        tabCount: 0,
      });
    }

    if (!merged.some((agent) => agent.email === user.email.toLowerCase())) {
      const authAgent = authByEmail.get(user.email.toLowerCase());
      merged.unshift({
        id: user.id,
        key: user.email,
        email: user.email.toLowerCase(),
        name: authAgent?.name || user.name || user.email,
        role: authAgent?.role || user.role,
        status: authAgent?.status ?? 'offline',
        lastSeenAt: authAgent?.lastSeenAt ?? null,
        lastLoggedInAt: authAgent?.lastLoggedInAt ?? null,
        activeRoute: authAgent?.activeRoute ?? null,
        activeTicketId: authAgent?.activeTicketId ?? null,
        tabCount: authAgent?.tabCount ?? 0,
      });
    }

    merged.sort((a, b) => {
      const rank: Record<PresenceStatus, number> = { online: 0, away: 1, offline: 2 };
      const statusDelta = rank[a.status] - rank[b.status];
      return statusDelta || a.email.localeCompare(b.email);
    });

    return NextResponse.json(
      { agents: merged, total: merged.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[api/presence/agents] failed:', err);
    return NextResponse.json({ agents: [], total: 0 });
  }
}
