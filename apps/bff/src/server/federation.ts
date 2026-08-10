import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from "@apollo/gateway";

type FederatedServices = Record<string, string>;
type FederatedService = {
  name: string;
  url: string;
};

export function getCommercePlatform() {
  return process.env.BFF_COMMERCE_PLATFORM ?? "commercetools";
}

export function buildGateway(): ApolloGateway | undefined {
  const services = parseFederatedServices(
    process.env.FEDERATED_SERVICES ?? defaultLocalFederatedServices()
  );

  if (services.length === 0) {
    console.warn("BFF running with local fallback schema. FEDERATED_SERVICES is not configured.");
    return undefined;
  }

  console.log(`BFF composing federated services: ${services.map((service) => service.name).join(", ")}`);

  return new ApolloGateway({
    buildService: ({ url }) =>
      new RemoteGraphQLDataSource({
        url,
        willSendRequest({ request }) {
          request.http?.headers.set("x-csa-commerce-platform", getCommercePlatform());
        }
      }),
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: services,
      // Without this, the gateway introspects every subgraph exactly once at
      // startup and never again — any schema change (a new field, a new
      // argument) on a subgraph requires a full BFF restart to become
      // reachable through the federated API, even though the subgraph itself
      // already serves it. That silent staleness broke createB2bCart's new
      // customerEmail argument and the new shippingMethods query/mutation
      // more than once during development. Polling makes new capabilities
      // show up on their own within a few seconds, same as a subgraph's own
      // hot reload — no restart dance needed for schema changes going forward.
      pollIntervalInMs: 10_000
    })
  });
}

function defaultLocalFederatedServices() {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  return JSON.stringify({
    "commerce-commercetools": "http://localhost:4310/graphql",
    ticketing: "http://localhost:4350/graphql"
  });
}

function parseFederatedServices(value: string | undefined) {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(stripTrailingCommas(value)) as FederatedServices;

  return selectCommerceService(
    Object.entries(parsed).map(([name, url]) => ({
      name,
      url
    }))
  );
}

function stripTrailingCommas(value: string) {
  return value.replace(/,\s*([}\]])/g, "$1");
}

function selectCommerceService(services: FederatedService[]) {
  const selectedCommerceServiceNames = getCommerceServiceNameCandidates(getCommercePlatform());
  const commerceServices = services.filter((service) => isCommerceService(service.name));
  const nonCommerceServices = services.filter((service) => !isCommerceService(service.name));

  if (commerceServices.length === 0) {
    return services;
  }

  const selectedCommerceService =
    commerceServices.find((service) => selectedCommerceServiceNames.includes(service.name)) ??
    commerceServices.find((service) => service.name === "commerce");

  return selectedCommerceService
    ? [...nonCommerceServices, selectedCommerceService]
    : nonCommerceServices;
}

function isCommerceService(name: string) {
  return name === "commerce" || name.startsWith("commerce-");
}

function getCommerceServiceNameCandidates(platform: string) {
  if (platform === "salesforce" || platform === "sfcc") {
    return ["commerce-salesforce", "commerce-sfcc"];
  }

  return [`commerce-${platform}`];
}
