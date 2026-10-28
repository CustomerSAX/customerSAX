import { hubRuntime } from "@csa/connection-hub";
import { assertProjectScope } from "@csa/mongodb";

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
    ![
      "agent",
      "admin",
      "superadmin",
      "CSA Agent",
      "CSA Administrator",
      "CSA Super Administrator"
    ].includes(identity.userRole ?? "")
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
  await assertProjectScope({ clientId, projectKey });
  const scope = await hubRuntime.project(clientId, projectKey).catch(() => { throw unavailable(); });
  const binding = scope?.bindings.find(item => item.connectorId === "zendesk" && item.canonicalAction === "zendesk-find-tickets" && item.operation === "find-tickets" && item.enabled);
  if (!scope || !binding) throw unavailable();
  const result = await hubRuntime.execute(scope, binding, {
    search_type: "custom", custom_query: `type:ticket ${query.trim()}`
  }).catch(() => { throw unavailable(); });
  const data = result.data;
  if (result.status !== 200 || !record(data) || data.success !== true || !Array.isArray(data.tickets)) throw unavailable();
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
