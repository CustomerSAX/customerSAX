import { NextRequest, NextResponse } from 'next/server';
import { forwardRequestId, requestLogger } from '@/lib/request-logger';

/**
 * GET /api/agent-registry/users[?q=partial+name]
 *
 * Returns CSA agents for the ticket assignment picker and the AI assistant's
 * list_assignees tool. Agents are registered in CommerceTools as custom
 * objects (container: "mc-user-info") — the same source the standalone
 * reference implementation uses (FETCH_USERS_LIST / CONSTANTS.USER_CONTAINER).
 *
 * Architecture: webapp → BFF GraphQL (port 4000) → CT subgraph agentList
 * resolver → commercetoolsGraphql("customObjects") → CommerceTools API.
 * No direct MongoDB or CT API calls from the webapp.
 */

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

interface AgentUserGql {
  id: string;
  key: string;
  email: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { log, requestId } = requestLogger(request, 'api/agent-registry/users');
  try {
    const res = await fetch(BFF_URL, {
      method: 'POST',
      headers: forwardRequestId(requestId, {
        'content-type': 'application/json',
        'x-csa-commerce-platform': 'commercetools',
      }),
      body: JSON.stringify({
        query: AGENT_LIST_QUERY,
        variables: { container: AGENT_CONTAINER },
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      log.warn('BFF returned non-ok', { status: res.status });
      return NextResponse.json({ users: [], total: 0 });
    }

    const payload = await res.json() as {
      data?: { agentList?: { results: AgentUserGql[]; total: number } };
      errors?: unknown[];
    };

    if (payload.errors?.length) {
      log.warn('BFF GraphQL errors', { count: payload.errors?.length });
      return NextResponse.json({ users: [], total: 0 });
    }

    const agents = payload.data?.agentList?.results ?? [];

    // Optional name/email filter (?q=...) for autocomplete
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.toLowerCase().trim();
    const filtered = q
      ? agents.filter((a) => a.email.toLowerCase().includes(q))
      : agents;

    // Map to the shape the stepper and list_assignees tool expect
    const users = filtered.map((a) => ({
      id: a.id,
      name: a.email,   // CT custom objects only store email; use it as display name
      email: a.email,
      role: 'agent',
    }));

    return NextResponse.json(
      { users, total: users.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    log.error('failed', err);
    return NextResponse.json({ users: [], total: 0 });
  }
}
