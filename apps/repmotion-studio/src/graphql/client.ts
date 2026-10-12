"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

// The RepMotion Studio browser app routes GraphQL requests through Next.js /api/graphql,
// mirroring Customer CX Studio.
// Next.js /api/graphql reads the browser's csa_session cookie, validates the session with
// the Auth service, and attaches tenant/project headers before forwarding to the BFF Gateway.
const graphqlUrl = "/api/graphql";

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: graphqlUrl,
    credentials: "same-origin"
  })
});
