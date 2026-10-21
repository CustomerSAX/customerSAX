import { GraphQLError } from "graphql";
import type { api } from "./client.js";

function fail(): never {
  throw new GraphQLError(
    "Zendesk is unavailable through Connection Hub. Check the project connection.",
    { extensions: { code: "PROVIDER_ERROR" } }
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function forProject({
  clientId,
  projectKey
}: {
  clientId: string;
  projectKey: string;
}): Promise<{ subdomain: string; api: typeof api } | undefined> {
  if (
    process.env.CONNECTION_HUB_ENABLED !== "true" ||
    process.env.CONNECTION_HUB_CLIENT_ID !== clientId
  )
    return undefined;
  const key = process.env.CONNECTION_HUB_API_KEY;
  const base = process.env.CONNECTION_HUB_URL;
  if (!key || key.length < 16 || !base || !projectKey) fail();
  const url = new URL(base);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  )
    fail();
  const headers = { authorization: `Bearer ${key}`, "x-tenant-id": clientId };
  const response = await fetch(
    `${url.origin}/v1/projects/${encodeURIComponent(projectKey)}/bindings`,
    { headers, redirect: "error", signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) fail();
  const payload: unknown = await response.json();
  if (
    !record(payload) ||
    payload.applicationId !== "customersax" ||
    !Array.isArray(payload.bindings)
  )
    fail();
  const binding: unknown = payload.bindings.find(
    (item: unknown) =>
      record(item) &&
      item.canonicalAction === "zendesk-read" &&
      item.tenantId === clientId &&
      item.projectKey === projectKey
  );
  if (binding === undefined) return undefined;
  if (
    !record(binding) ||
    binding.connectorId !== "zendesk" ||
    binding.enabled !== true ||
    typeof binding.providerAccount !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(binding.providerAccount)
  )
    fail();
  return {
    subdomain: binding.providerAccount,
    api: async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
      if (method !== "GET" || body !== undefined)
        throw new GraphQLError("Connection Hub Zendesk supports reads in this POC", {
          extensions: { code: "UNSUPPORTED_OPERATION" }
        });
      const result = await fetch(
        `${url.origin}/v1/projects/${encodeURIComponent(projectKey)}/actions/zendesk-read`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ path }),
          redirect: "error",
          signal: AbortSignal.timeout(30000)
        }
      );
      if (!result.ok) fail();
      const envelope: unknown = await result.json();
      if (!record(envelope)) fail();
      const execution: unknown = envelope.execution;
      if (
        !record(execution) ||
        execution.mode !== "live" ||
        execution.tenantId !== clientId ||
        execution.projectKey !== projectKey ||
        execution.connector !== "@rc-connect/zendesk" ||
        execution.connectionId !== binding.connectionId ||
        !record(envelope.data)
      )
        fail();
      if (execution.providerStatus === 404)
        throw new GraphQLError("Zendesk ticket not found", {
          extensions: { code: "NOT_FOUND" }
        });
      if (execution.providerStatus !== 200) fail();
      return envelope.data as T;
    }
  };
}

export const connectionHubZendesk = { forProject };
