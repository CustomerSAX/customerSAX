import { GraphQLError } from "graphql";
import { hubRuntime, HubRuntimeError } from "@csa/connection-hub";
import type { api } from "./client.js";

async function forProject({
  clientId,
  projectKey
}: {
  clientId: string;
  projectKey: string;
}): Promise<{ subdomain: string; api: typeof api } | undefined> {
  const scope = await hubRuntime.project(clientId, projectKey);
  if (!scope) return undefined;
  const reads = scope.bindings.filter(
    (item) =>
      item.connectorId === "zendesk" &&
      item.canonicalAction === "zendesk-read" &&
      item.enabled
  );
  const custom = scope.bindings.find(
    (item) =>
      item.connectorId === "zendesk" &&
      item.canonicalAction === "zendesk-custom-api-call" &&
      item.enabled
  );
  const binding = reads[0] ?? custom;
  if (!binding) return undefined;
  const subdomain = binding.providerAccount;
  if (!subdomain || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain))
    throw new HubRuntimeError("Invalid Zendesk account in Connection Hub", 502);
  if (custom && custom.connectionId !== binding.connectionId)
    throw new HubRuntimeError(
      "Zendesk actions use different accounts. Reconnect Zendesk in Connection Hub.",
      409
    );
  return {
    subdomain,
    api: async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
      if (method === "GET" && body === undefined && reads[0]) {
        const result = await hubRuntime.execute(scope, reads[0], { path });
        if (result.status === 404)
          throw new GraphQLError("Zendesk ticket not found", {
            extensions: { code: "NOT_FOUND" }
          });
        if (
          result.status !== 200 ||
          typeof result.data !== "object" ||
          result.data === null ||
          Array.isArray(result.data)
        )
          throw new HubRuntimeError(
            "Zendesk request failed. Check its Connection Hub connection.",
            result.status
          );
        return result.data as T;
      }
      if (!custom)
        throw new GraphQLError(
          "Enable Zendesk Custom API Call in Connection Hub to use this ticket action.",
          { extensions: { code: "UNSUPPORTED_OPERATION" } }
        );
      const result = await hubRuntime.api<T>(scope, custom, path, method, body);
      if (result === null)
        throw new GraphQLError("Zendesk ticket not found", {
          extensions: { code: "NOT_FOUND" }
        });
      return result;
    }
  };
}
export const connectionHubZendesk = { forProject };
