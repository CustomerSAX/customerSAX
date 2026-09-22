"use client";

import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";

// The Studio browser app MUST route GraphQL requests through Next.js /api/graphql.
// Next.js /api/graphql reads the browser's csa_session cookie, validates the session with
// the Auth service, and attaches x-csa-user-role and x-csa-user-email headers before
// forwarding the query to the BFF Gateway on port 4000.
const graphqlUrl = "/api/graphql";

function cleanTypename(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanTypename);
  }
  if (value !== null && typeof value === "object") {
    const newObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (key !== "__typename") {
        newObj[key] = cleanTypename(val);
      }
    }
    return newObj;
  }
  return value;
}

const omitTypenameLink = new ApolloLink((operation, forward) => {
  if (operation.variables) {
    operation.variables = cleanTypename(operation.variables) as Record<string, unknown>;
  }
  return forward(operation);
});

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.from([
    omitTypenameLink,
    new HttpLink({
      uri: graphqlUrl,
      credentials: "same-origin"
    })
  ])
});
