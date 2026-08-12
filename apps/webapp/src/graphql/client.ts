"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const graphqlUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "/api/graphql";

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: graphqlUrl
  })
});
