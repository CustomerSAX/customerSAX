import { GraphQLScalarType } from "graphql";
import { algoliaHub } from "@csa/connection-hub";
import { assertProjectProductsScope } from "@csa/mongodb";

export async function projectConnectionHubProducts(
  _parent: unknown,
  { query = "", limit = 20 }: { query?: string; limit?: number },
  context: {
    clientId?: string;
    projectKey?: string;
    userEmail?: string;
    userRole?: string;
  }
) {
  if (
    !context.clientId ||
    !context.projectKey ||
    !context.userEmail ||
    ![
      "agent",
      "admin",
      "superadmin",
      "CSA Agent",
      "CSA Administrator",
      "CSA Super Administrator"
    ].includes(context.userRole ?? "")
  )
    throw new Error("An authenticated active project is required.");
  if (
    typeof query !== "string" ||
    query.trim().length > 300 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new Error("Enter a valid product search.");
  await assertProjectProductsScope({
    clientId: context.clientId,
    projectKey: context.projectKey
  });
  try {
    const scope = await algoliaHub.forProject({
      clientId: context.clientId,
      projectKey: context.projectKey
    });
    if (!scope) return { selected: false, results: [], total: null };
    return { selected: true, ...(await algoliaHub.search({ scope, query, limit })) };
  } catch {
    throw new Error(
      "Algolia search is unavailable. Check the selected Connection Hub connector."
    );
  }
}

export const connectionHubProductRecord = new GraphQLScalarType({
  name: "ConnectionHubProductRecord",
  serialize(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new Error("Invalid product record");
    return value;
  },
  parseValue() {
    throw new Error("Product records are output only");
  },
  parseLiteral() {
    throw new Error("Product records are output only");
  }
});
