import { commercetoolsGraphql } from "../../../commercetools/client.js";

const DEFAULT_CONTAINER = "mc-user-info";

interface CtCustomObjectResult {
  id: string;
  key: string;
  value: unknown;
}

interface CtCustomObjectsResponse {
  customObjects: {
    total: number;
    results: CtCustomObjectResult[];
  };
}

/**
 * Fetches CSA agents from CommerceTools custom objects.
 *
 * Agents are stored under the "mc-user-info" container (the same container
 * the standalone reference implementation uses via FETCH_USERS_LIST). Each
 * custom object's `value` is a JSON blob containing at minimum `{ email }`.
 *
 * @param container - CT custom-object container name; defaults to "mc-user-info".
 * @returns Typed AgentListResult ready for the GraphQL resolver.
 */
async function fetchAgentList(container: string) {
  const data = await commercetoolsGraphql<CtCustomObjectsResponse>(
    `#graphql
      query FetchAgentList($container: String!) {
        customObjects(container: $container) {
          total
          results {
            id
            key
            value
          }
        }
      }
    `,
    { container }
  );

  const raw = data.customObjects?.results ?? [];
  const results = raw
    .filter((obj) => {
      const v = obj.value as Record<string, unknown> | null | undefined;
      return typeof v?.email === "string" && v.email.trim() !== "";
    })
    .map((obj) => {
      const v = obj.value as Record<string, unknown>;
      return {
        id: obj.id,
        key: obj.key,
        email: (v.email as string).trim(),
      };
    });

  return { results, total: results.length };
}

export const resolvers = {
  agentList: (_parent: unknown, args: { container?: string }) =>
    fetchAgentList(args.container ?? DEFAULT_CONTAINER),
};
