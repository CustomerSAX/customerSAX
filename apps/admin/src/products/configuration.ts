import { resolveProjectProducts } from "@csa/mongodb";

/** Identity is supplied by the trusted BFF, never by GraphQL arguments. */
export async function projectProductsConfiguration(
  _parent: unknown,
  _args: unknown,
  context: { clientId?: string; projectKey?: string; userEmail?: string }
) {
  if (!context.userEmail || !context.clientId || !context.projectKey) {
    throw new Error("An authenticated active project is required");
  }
  return resolveProjectProducts(context.clientId, context.projectKey);
}
