import { GraphQLError } from "graphql";

/** Throws a coded GraphQL error that reaches the client with a readable message. */
export function error(message: string, code = "BAD_USER_INPUT"): never {
  throw new GraphQLError(message, { extensions: { code } });
}
