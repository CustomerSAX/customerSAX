import { typeDefs } from "./product.graphql.js";
import { resolvers } from "./product.resolvers.js";

export const product = {
  resolvers,
  typeDefs: [typeDefs]
};
