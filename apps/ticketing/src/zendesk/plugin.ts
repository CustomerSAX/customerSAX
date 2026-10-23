import { resolveProjectTicketing } from "@csa/mongodb";

type Identity = {
  clientId?: string;
  projectKey?: string;
  userEmail?: string;
  userRole?: string;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const unavailable = () =>
  new Error(
    "Connect the Zendesk plugin for this project in CSA Assistant. Check the connection if it is already connected."
  );

export async function searchZendeskPlugin(identity: Identity, query: string, limit = 10) {
  const { clientId, projectKey } = identity;
  if (
    !clientId ||
    !projectKey ||
    !identity.userEmail ||
    // AI Assist forwards its authenticated role display label through BFF.
    !["agent", "admin", "superadmin", "CSA Agent", "CSA Administrator", "CSA Super Administrator"].includes(identity.userRole ?? "")
  )
    throw new Error("An authenticated agent and active project are required.");
  if (
    typeof query !== "string" ||
    !query.trim() ||
    query.length > 300 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 20
  )
    throw new Error("Enter a search query and a limit between 1 and 20.");
  // Authorize project ownership without changing its selected ticketing provider.
  await resolveProjectTicketing(clientId, projectKey);
  const prod = process.env.USE_CONNECTION_HUB_PROD ?? "false";
  if (
    process.env.CONNECTION_HUB_ENABLED !== "true" ||
    process.env.CONNECTION_HUB_CLIENT_ID !== clientId ||
    !["true", "false"].includes(prod)
  )
    throw unavailable();
  const base =
    prod === "true"
      ? process.env.CONNECTION_HUB_PROD_URL
      : process.env.CONNECTION_HUB_URL;
  const key = (
    prod === "true"
      ? process.env.CONNECTION_HUB_PROD_API_KEY
      : process.env.CONNECTION_HUB_API_KEY
  )?.trim();
  const tenantId =
    (prod === "true"
      ? process.env.CONNECTION_HUB_PROD_TENANT_ID
      : process.env.CONNECTION_HUB_TENANT_ID
    )?.trim() || clientId;
  if (!base || !key || key.length < 16 || /\s/.test(key)) throw unavailable();
  const url = new URL(base);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        prod === "false" &&
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname)
      ))
  )
    throw unavailable();
  const headers = {
    authorization: `Bearer ${key}`,
    "x-tenant-id": tenantId,
    "content-type": "application/json"
  };
  const response = await fetch(
    `${url.origin}/v1/projects/${encodeURIComponent(projectKey)}/bindings`,
    { headers, redirect: "error", signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) throw unavailable();
  const payload: unknown = await response.json();
  if (
    !record(payload) ||
    !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
    !Array.isArray(payload.bindings)
  )
    throw unavailable();
  const binding: unknown = payload.bindings.find(
    (item: unknown) =>
      record(item) &&
      item.tenantId === tenantId &&
      item.projectKey === projectKey &&
      item.canonicalAction === "zendesk-find-tickets"
  );
  if (
    !record(binding) ||
    binding.enabled !== true ||
    binding.connectorId !== "zendesk" ||
    typeof binding.id !== "string" ||
    typeof binding.connectionId !== "string"
  )
    throw unavailable();
  const result = await fetch(
    `${url.origin}/v1/projects/${encodeURIComponent(projectKey)}/actions/zendesk-find-tickets`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        search_type: "custom",
        custom_query: `type:ticket ${query.trim()}`
      }),
      redirect: "error",
      signal: AbortSignal.timeout(30000)
    }
  );
  if (!result.ok) throw unavailable();
  const envelope: unknown = await result.json();
  if (!record(envelope) || !record(envelope.execution) || !record(envelope.data))
    throw unavailable();
  const execution = envelope.execution;
  const data = envelope.data;
  if (
    execution.mode !== "live" ||
    execution.connector !== "@rc-connect/zendesk" ||
    execution.tenantId !== tenantId ||
    execution.projectKey !== projectKey ||
    execution.bindingId !== binding.id ||
    execution.connectionId !== binding.connectionId ||
    execution.action !== "find-tickets" ||
    execution.providerStatus !== 200 ||
    data.success !== true ||
    !Array.isArray(data.tickets)
  )
    throw unavailable();
  const results = data.tickets.slice(0, limit).map((ticket: unknown) => {
    if (
      !record(ticket) ||
      (typeof ticket.id !== "number" && typeof ticket.id !== "string") ||
      typeof ticket.subject !== "string" ||
      typeof ticket.status !== "string"
    )
      throw unavailable();
    return {
      id: String(ticket.id),
      subject: ticket.subject,
      status: ticket.status,
      priority: typeof ticket.priority === "string" ? ticket.priority : null
    };
  });
  return {
    results,
    count: results.length,
    total:
      Number.isSafeInteger(data.total_count) && Number(data.total_count) >= 0
        ? Number(data.total_count)
        : results.length
  };
}
