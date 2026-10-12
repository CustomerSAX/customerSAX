import { createSendGridProvider } from "./sendgrid.js";
import type { EmailProvider } from "./types.js";

/** Explicit config keeps this package independent of any app's environment. */
export function createEmailProvider(config: { provider: string; apiKey: string }, request: typeof fetch = fetch): EmailProvider {
  if (config.provider !== "sendgrid") throw new Error(`Unsupported email provider: ${config.provider}`);
  if (!config.apiKey.trim()) throw new Error("Email provider API key is required");
  return createSendGridProvider(config.apiKey, request);
}
