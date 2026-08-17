import { getCommercePlatform } from "./federation.js";

// No-federation fallback schema. This only serves when `FEDERATED_SERVICES` is
// unset (local dev without the real subgraphs). It deliberately does NOT expose
// a `serviceMap`/service-status field: the previous version reported a
// hardcoded `status: "online"` for eight named services regardless of whether
// any of them were actually running — a fabricated status that violates the
// project's no-mock-data rule. Since this path runs precisely when nothing is
// federated, there is no real status to report, so the field is removed rather
// than faking one.
const typeDefs = `#graphql
  type Query {
    commercePlatform: String!
    hello: String!
  }
`;

const resolvers = {
  Query: {
    commercePlatform: () => getCommercePlatform(),
    hello: () => "Hello from the CSA GraphQL BFF"
  }
};

export const localSchema = {
  resolvers,
  typeDefs
};
