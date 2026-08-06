import { typeDefs } from "./cart.graphql.js";
import { resolvers } from "./cart.resolvers.js";

export const cart = {
  resolvers,
  typeDefs: [typeDefs]
};
