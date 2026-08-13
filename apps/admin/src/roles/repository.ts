import { ObjectId } from "@csa/mongodb";
import { getRolesCollection } from "../db/mongodb.js";

export type Permission = { module: string; view: boolean; create: boolean; update: boolean; delete: boolean };
export type RoleRecord = { _id: ObjectId; clientId: string; projectKey: string; key: string; label: string; description: string; system: boolean; permissions: Permission[]; createdAt: Date; updatedAt: Date };

const modules = ["dashboard", "tickets", "customers", "orders", "carts", "products", "reports", "knowledgebase", "assistant", "users", "roles", "email", "audit"];
const full = modules.map((module) => ({ module, view: true, create: true, update: true, delete: true }));
const viewOnly = modules.map((module) => ({ module, view: true, create: false, update: false, delete: false }));

export async function ensureDefaultRoles(clientId: string, projectKey: string) {
  const collection = await getRolesCollection();
  const defaults = [
    { key: "admin", label: "Admin", description: "Full access: view, create, update, delete, and user/role management", permissions: full },
    { key: "member", label: "Member", description: "View-only access to CSA modules", permissions: viewOnly },
    { key: "customer_service_agent", label: "CS Agent", description: "Perform actions for CSA agent", permissions: full.filter((p) => !["users", "roles", "email"].includes(p.module)) }
  ];
  for (const role of defaults) {
    await collection.updateOne({ clientId, projectKey, key: role.key }, { $setOnInsert: { ...role, clientId, projectKey, system: true, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
  }
}

export async function listRoles(clientId: string, projectKey: string) {
  await ensureDefaultRoles(clientId, projectKey);
  return collectionView(await (await getRolesCollection()).find({ clientId, projectKey }).sort({ system: -1, label: 1 }).toArray());
}

export async function createRole(clientId: string, projectKey: string, input: Omit<RoleRecord, "_id" | "clientId" | "projectKey" | "system" | "createdAt" | "updatedAt">) {
  const collection = await getRolesCollection();
  const doc = { _id: new ObjectId(), clientId, projectKey, ...input, key: input.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"), system: false, createdAt: new Date(), updatedAt: new Date() };
  await collection.insertOne(doc);
  return view(doc);
}

export async function updateRole(id: string, clientId: string, projectKey: string, input: { label?: string; description?: string; permissions?: Permission[] }) {
  const _id = new ObjectId(id);
  await (await getRolesCollection()).updateOne({ _id, clientId, projectKey }, { $set: { ...input, updatedAt: new Date() } });
  const doc = await (await getRolesCollection()).findOne({ _id, clientId, projectKey });
  return doc ? view(doc as unknown as RoleRecord) : null;
}

export async function deleteRole(id: string, clientId: string, projectKey: string) {
  return (await (await getRolesCollection()).deleteOne({ _id: new ObjectId(id), clientId, projectKey, system: false })).deletedCount === 1;
}

function collectionView(values: unknown[]) { return values.map((value) => view(value as RoleRecord)); }
function view({ _id, ...role }: RoleRecord) { return { id: _id.toHexString(), ...role }; }
