import { typeDefs } from "./customer.graphql.js";
import { resolvers } from "./customer.resolvers.js";

export const customer = {
  resolvers,
  typeDefs: [typeDefs]
};
