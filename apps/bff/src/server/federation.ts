/**
 * Builds the Apollo Gateway that fronts every backend subgraph.
 *
 * The load-bearing rule for commerce: the gateway composes exactly ONE commerce
 * subgraph, never several at once. Each commerce adapter (commercetools,
 * shopify, ...) intentionally exposes the SAME platform-neutral CSA schema, so
 * composing two would be a type collision. `selectCommerceService` picks the
 * single adapter that matches `BFF_COMMERCE_PLATFORM` out of the configured
 * `FEDERATED_SERVICES` map and drops the rest, while leaving all non-commerce
 * subgraphs (ticketing, admin, ...) untouched. Switching platforms is therefore
 * a one-env-var change on the BFF, with no change to any consumer.
 *
 * Requests also carry per-tenant/user identity down to the subgraphs via the
 * `x-csa-*` headers set in `willSendRequest`, plus a GCP identity token when
 * running on Cloud Run (`getIdentityToken`).
 */
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from "@apollo/gateway";
import { GoogleAuth } from "google-auth-library";

type FederatedServices = Record<string, string>;
type FederatedService = {
  name: string;
  url: string;
};

export type GatewayContext = { clientId?: string; projectKey?: string; userEmail?: string; userRole?: string };

export function getCommercePlatform() {
  return process.env.BFF_COMMERCE_PLATFORM ?? "commercetools";
}

const auth = new GoogleAuth();
const tokenCache = new Map<string, string>();

async function getIdentityToken(targetUrl: string): Promise<string | undefined> {
  // Only attempt GCP authentication if we're in production (running on Cloud Run)
  if (process.env.NODE_ENV !== "production") return undefined;

  const audience = new URL(targetUrl).origin;
  
  if (!tokenCache.has(audience)) {
    try {
      const client = await auth.getIdTokenClient(audience);
      const token = await client.idTokenProvider.fetchIdToken(audience);
      tokenCache.set(audience, token);
      
      // Auto-refresh token cache (Google tokens expire in ~1h)
      setTimeout(() => tokenCache.delete(audience), 50 * 60 * 1000);
    } catch (e) {
      console.error(`Failed to get identity token for ${audience}:`, e);
      return undefined;
    }
  }

  return tokenCache.get(audience);
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
        async willSendRequest({ request, context }) {
          if (url) {
            const token = await getIdentityToken(url);
            if (token) request.http?.headers.set("Authorization", `Bearer ${token}`);
          }
          request.http?.headers.set("x-csa-commerce-platform", getCommercePlatform());
          const gatewayContext = context as GatewayContext;
          if (gatewayContext.projectKey) request.http?.headers.set("x-csa-project-key", gatewayContext.projectKey);
          if (gatewayContext.clientId) request.http?.headers.set("x-csa-client-id", gatewayContext.clientId);
          if (gatewayContext.userRole) request.http?.headers.set("x-csa-user-role", gatewayContext.userRole);
          if (gatewayContext.userEmail) request.http?.headers.set("x-csa-user-email", gatewayContext.userEmail);
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
      pollIntervalInMs: 10_000,
      async introspectionHeaders(service) {
        const headers: Record<string, string> = {};
        if (!service.url) return headers;
        const token = await getIdentityToken(service.url);
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
      }
    })
  });
}

function defaultLocalFederatedServices() {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  return JSON.stringify({
    "commerce-commercetools": "http://localhost:4310/graphql",
    ticketing: "http://localhost:4350/graphql",
    admin: "http://localhost:4370/graphql"
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

/**
 * Reduces the configured service list to at most one commerce subgraph.
 *
 * Non-commerce services always pass through. Among the commerce services
 * (`commerce` or `commerce-*`), keep only the one whose name matches the
 * selected `BFF_COMMERCE_PLATFORM` (see `getCommerceServiceNameCandidates` for
 * the `salesforce`/`sfcc` alias), falling back to a bare `commerce` entry if
 * present. If commerce services are configured but none match the selected
 * platform, drop them all rather than composing the wrong backend.
 */
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
