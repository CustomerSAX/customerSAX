import type { Ticket } from "../tickets/types.js";
type Identity = { clientId?: string; projectKey?: string; userEmail?: string; userRole?: string };
type Pending = { ticket: Ticket; resolve: (status: string) => void };
const batches = new WeakMap<object, Pending[]>();

/** Per-request batching avoids an HTTP/database request for every table row. */
export function loadAIStatus(ticket: Ticket, context: unknown): Promise<string> {
  if (/^(zendesk|freshdesk):/.test(ticket.id)) return Promise.resolve("not_supported");
  const identity = context as Identity | undefined;
  if (!identity?.clientId || !identity.projectKey || !identity.userEmail) return Promise.resolve("unavailable");
  return new Promise(resolve => {
    const existing = batches.get(identity);
    if (existing) { existing.push({ ticket, resolve }); return; }
    const pending: Pending[] = [{ ticket, resolve }];
    batches.set(identity, pending);
    setTimeout(() => {
      batches.delete(identity);
      for (let start = 0; start < pending.length; start += 100) void fetchBatch(pending.slice(start, start + 100), identity);
    }, 0);
  });
}
async function fetchBatch(pending: Pending[], identity: Identity) {
  try {
    const response = await fetch(`${process.env.AI_ASSIST_URL ?? "http://localhost:8080"}/ticket-review/statuses`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csa-client-id": identity.clientId!, "x-csa-project-key": identity.projectKey!, "x-csa-user-email": identity.userEmail!, "x-csa-user-role": identity.userRole ?? "" },
      body: JSON.stringify({ tickets: pending.map(({ ticket }) => ({ id: ticket.id, status: ticket.status })) }),
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error("AI status unavailable");
    const data = await response.json() as { statuses: Array<{ id: string; status: string }> };
    const statuses = new Map(data.statuses.map(item => [item.id, item.status]));
    pending.forEach(({ ticket, resolve }) => resolve(statuses.get(ticket.id) ?? "unavailable"));
  } catch { pending.forEach(({ resolve }) => resolve("unavailable")); }
}
