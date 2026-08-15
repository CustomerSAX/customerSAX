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
import { getOrSet, bffIdentityToken } from "@csa/cache";
import { applyCsaHeaders } from "@csa/headers";
import { type Logger, type RequestContext } from "@csa/logger";

type FederatedServices = Record<string, string>;
type FederatedService = {
  name: string;
  url: string;
};

export type GatewayContext = RequestContext;

export function getCommercePlatform() {
  return process.env.BFF_COMMERCE_PLATFORM ?? "commercetools";
}

const auth = new GoogleAuth();

async function getIdentityToken(targetUrl: string, logger?: Logger): Promise<string | undefined> {
  // Only attempt GCP authentication if we're in production (running on Cloud Run)
  if (process.env.NODE_ENV !== "production") return undefined;

  const audience = new URL(targetUrl).origin;

  try {
    // `getOrSet` replaces the hand-rolled Map + setTimeout: single-flight
    // collapses concurrent cold-cache fetches, and the 50-minute TTL preserves
    // the previous auto-refresh window (Google identity tokens expire in ~1h).
    return await getOrSet(bffIdentityToken(audience), 50 * 60, async () => {
      const client = await auth.getIdTokenClient(audience);
      return client.idTokenProvider.fetchIdToken(audience);
    });
  } catch (e) {
    logger?.error("failed to get identity token", e, { audience });
    return undefined;
  }
}

export function buildGateway(logger: Logger): ApolloGateway | undefined {
  const services = parseFederatedServices(
    process.env.FEDERATED_SERVICES ?? defaultLocalFederatedServices()
  );

  if (services.length === 0) {
    logger.warn("running with local fallback schema — FEDERATED_SERVICES is not configured");
    return undefined;
  }

  logger.info("composing federated services", { services: services.map((service) => service.name).join(", ") });

  // url -> subgraph name, so each forward is traceable by service (not just url).
  const serviceNameByUrl = new Map(services.map((service) => [service.url, service.name]));

  return new ApolloGateway({
    buildService: ({ url }) =>
      new RemoteGraphQLDataSource({
        url,
        async willSendRequest({ request, context }) {
          if (url) {
            const token = await getIdentityToken(url, logger);
            if (token) request.http?.headers.set("Authorization", `Bearer ${token}`);
          }
          const gatewayContext = context as GatewayContext;
          // Per-hop trace: which subgraph this request is being forwarded to,
          // correlated by requestId. Debug-level (one line per subgraph hop).
          logger.debug("subgraph forward", {
            service: (url ? serviceNameByUrl.get(url) : undefined) ?? url ?? "unknown",
            requestId: gatewayContext.requestId
          });
          if (request.http) {
            // Forward the tenant/user identity + correlation id so a request can
            // be traced (and scoped) across every subgraph hop. Only present
            // fields are written — see `applyCsaHeaders`.
            applyCsaHeaders(request.http.headers, {
              commercePlatform: getCommercePlatform(),
              requestId: gatewayContext.requestId,
              projectKey: gatewayContext.projectKey,
              clientId: gatewayContext.clientId,
              userRole: gatewayContext.userRole,
              userEmail: gatewayContext.userEmail,
            });
          }
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
        const token = await getIdentityToken(service.url, logger);
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
