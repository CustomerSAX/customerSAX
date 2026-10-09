"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

// The Studio browser app MUST route GraphQL requests through Next.js /api/graphql.
// Next.js /api/graphql reads the browser's csa_session cookie, validates the session with
// the Auth service, and attaches x-csa-user-role and x-csa-user-email headers before
// forwarding the query to the BFF Gateway on port 4000.
const graphqlUrl = "/api/graphql";

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies: {
      Customer: {
        keyFields: ["id"],
      },
      Order: {
        keyFields: ["id"],
      },
      Ticket: {
        keyFields: ["id"],
      },
      Subscription: {
        keyFields: ["id"],
      },
      Company: {
        keyFields: ["id"],
      },
      Quote: {
        keyFields: ["id"],
      },
      Cart: {
        keyFields: ["id"],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "cache-first",
    },
    query: {
      fetchPolicy: "cache-first",
    },
  },
  link: new HttpLink({
    uri: graphqlUrl,
    credentials: "same-origin"
  })
});
