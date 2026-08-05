import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from "@apollo/gateway";

type FederatedServices = Record<string, string>;

export function getCommercePlatform() {
  return process.env.BFF_COMMERCE_PLATFORM ?? "commercetools";
}

export function buildGateway(): ApolloGateway | undefined {
  const services = parseFederatedServices(process.env.FEDERATED_SERVICES);

  if (services.length === 0) {
    return undefined;
  }

  return new ApolloGateway({
    buildService: ({ url }) =>
      new RemoteGraphQLDataSource({
        url,
        willSendRequest({ request }) {
          request.http?.headers.set("x-csa-commerce-platform", getCommercePlatform());
        }
      }),
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: services
    })
  });
}

function parseFederatedServices(value: string | undefined) {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(stripTrailingCommas(value)) as FederatedServices;

  return Object.entries(parsed).map(([name, url]) => ({
    name,
    url
  }));
}

function stripTrailingCommas(value: string) {
  return value.replace(/,\s*([}\]])/g, "$1");
}
