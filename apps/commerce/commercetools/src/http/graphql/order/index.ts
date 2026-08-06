import { typeDefs } from "./order.graphql.js";
import { resolvers } from "./order.resolvers.js";

export const order = {
  resolvers,
  typeDefs: [typeDefs]
};
