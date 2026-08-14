import { getAuditCollection } from "@csa/mongodb";

export async function recordAdminAudit(event: { actor: string; action: string; clientId?: string; projectKey?: string; target?: string }) {
  await (await getAuditCollection()).insertOne({ ...event, createdAt: new Date() });
}
