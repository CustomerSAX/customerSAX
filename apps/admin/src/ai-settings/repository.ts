import { encrypt, getAiSettingsCollection } from "@csa/mongodb";

export async function getAiSettings(clientId: string) {
  const doc = await (await getAiSettingsCollection()).findOne({ clientId });
  if (!doc) return { clientId, enabled: false, provider: "openai", displayName: "CSA Assistant", model: "gpt-4o-mini", apiKeySet: false };
  const { _id, apiKeyEncrypted, ...safe } = doc;
  void _id;
  return { ...safe, apiKeySet: Boolean(apiKeyEncrypted) };
}

export async function updateAiSettings(clientId: string, input: { enabled: boolean; provider: string; displayName: string; model: string; baseUrl?: string; apiKey?: string }, updatedBy: string) {
  const set: Record<string, unknown> = { enabled: input.enabled, provider: input.provider.trim(), displayName: input.displayName.trim(), model: input.model.trim(), baseUrl: input.baseUrl?.trim() || null, updatedBy, updatedAt: new Date() };
  if (input.apiKey?.trim()) set.apiKeyEncrypted = encrypt(input.apiKey.trim());
  await (await getAiSettingsCollection()).updateOne({ clientId }, { $set: set, $setOnInsert: { clientId, createdAt: new Date() } }, { upsert: true });
  return getAiSettings(clientId);
}
