import { NextRequest, NextResponse } from 'next/server';
import { requestLogger } from '@/lib/request-logger';
import { projectScopedBffFetch, ProjectSessionError } from '@/lib/project-scoped-bff';
import { getCurrentUser } from '@/lib/get-current-user';

/**
 * GET /api/agent-registry/users[?q=partial+name]
 *
 * Returns project users for the ticket assignment picker and the AI
 * assistant's list_assignees tool. The platform user directory is the source
 * of truth because it is also used by Admin Settings. The legacy CommerceTools
 * custom-object registry remains a fallback for older projects.
 *
 * Architecture: studio → federated BFF GraphQL → Admin user directory, with
 * the CT agentList resolver as a compatibility fallback. The Studio does not
 * call MongoDB or the CommerceTools API directly.
 */

const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ??
  process.env.NEXT_PUBLIC_GRAPHQL_URL ??
  'http://localhost:4000/graphql';

const AGENT_CONTAINER = 'mc-user-info';

const PROJECT_USERS_QUERY = `
  query GetProjectUsers($clientId: ID!) {
    adminUsersByClient(clientId: $clientId) {
      id
      email
      firstName
      lastName
      active
      clientProjects {
        projectKey
        role
      }
    }
  }
`;

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

interface ProjectUserGql {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  active?: boolean | null;
  clientProjects?: Array<{ projectKey: string; role: string }> | null;
}

type AssigneeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function filterUsers(users: AssigneeUser[], query: string | undefined) {
  if (!query) return users;
  return users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(query)
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { log, requestId } = requestLogger(request, 'api/agent-registry/users');
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required', users: [], total: 0 }, { status: 401 });
    }

    const clientId = currentUser.activeClientId;
    const projectKey = currentUser.activeProjectKey ?? currentUser.projectKey;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase().trim() || undefined;

    if (clientId && projectKey) {
      const directoryResponse = await projectScopedBffFetch(BFF_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: PROJECT_USERS_QUERY,
          variables: { clientId },
        }),
        cache: 'no-store',
      }, requestId);

      if (directoryResponse.ok) {
        const directoryPayload = await directoryResponse.json() as {
          data?: { adminUsersByClient?: ProjectUserGql[] };
          errors?: unknown[];
        };
        if (!directoryPayload.errors?.length) {
          const projectUsers = (directoryPayload.data?.adminUsersByClient ?? [])
            .filter((user) =>
              user.active !== false &&
              user.clientProjects?.some((membership) => membership.projectKey === projectKey)
            )
            .map((user) => {
              const membership = user.clientProjects?.find((entry) => entry.projectKey === projectKey);
              const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
              return {
                id: user.id,
                name: name || user.email,
                email: user.email,
                role: membership?.role ?? 'member',
              };
            });
          if (projectUsers.length > 0) {
            const users = filterUsers(projectUsers, query);
            return NextResponse.json(
              { users, total: users.length },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        } else {
          log.warn('project user directory GraphQL errors', { count: directoryPayload.errors.length });
        }
      } else {
        log.warn('project user directory returned non-ok', { status: directoryResponse.status });
      }
    }

    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: AGENT_LIST_QUERY,
        variables: { container: AGENT_CONTAINER },
      }),
      cache: 'no-store',
    }, requestId);

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

    // Map to the shape the ticket form and list_assignees tool expect.
    const users = filterUsers(agents.map((a) => ({
      id: a.id,
      name: a.email,   // CT custom objects only store email; use it as display name
      email: a.email,
      role: 'agent',
    })), query);

    return NextResponse.json(
      { users, total: users.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    if (err instanceof ProjectSessionError) {
      return NextResponse.json({ error: err.message, users: [], total: 0 }, { status: err.status });
    }
    log.error('failed', err);
    return NextResponse.json({ users: [], total: 0 });
  }
}
