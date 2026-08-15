/**
 * LLM provider factory — the single entry point for obtaining a language model.
 *
 * Callers ask for a model by an optional provider id (and optional model id);
 * this module resolves the id to a `LlmProviderDefinition` in the registry and
 * delegates construction to it. Provider-specific knowledge lives entirely in
 * `registry.ts`; this file only decides *which* provider to use.
 *
 * BACKWARD COMPATIBILITY
 * ----------------------
 * The historical exports (`getLanguageModel`, `getConfiguredProvider`,
 * `listProviders`, `completeWithLlm`, and the `LlmProvider` type) are retained
 * as thin wrappers over the factory so existing callers (routes/chat.ts,
 * routes/assist.ts, routes/health.ts, routes/providers.ts) need no changes.
 *
 * A DELIBERATE RESOLUTION ASYMMETRY (preserved from the original)
 * --------------------------------------------------------------
 * `getLanguageModel(provider)` resolves purely from its argument and defaults to
 * OpenAI when none is given — it does NOT consult DEFAULT_LLM_PROVIDER.
 * `getConfiguredProvider()` is the one that reads DEFAULT_LLM_PROVIDER. These
 * are two distinct resolution sources and must stay distinct, so
 * `resolveProviderId()` maps a single raw string and never reads the environment
 * itself.
 */

import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { config } from "../config.js";
import { providerRegistry } from "./registry.js";
import type { LlmProvider } from "./types.js";

export type { LlmProvider, LlmProviderDefinition } from "./types.js";
export { providerRegistry } from "./registry.js";

/**
 * Maps a raw provider string to a known provider id.
 * Accepts `"claude"` as an alias for `"anthropic"`. Defaults to `"openai"`.
 * Does not read the environment — callers pass whatever source they intend.
 */
export function resolveProviderId(providerId?: string): LlmProvider {
  const normalized = providerId?.toLowerCase();
  if (normalized === "anthropic" || normalized === "claude") return "anthropic";
  return "openai";
}

/**
 * Builds a `LanguageModel` for the given provider/model.
 * @param providerId Optional provider id (or `"claude"` alias); defaults to OpenAI.
 * @param modelId    Optional explicit model id; falls back to the provider default.
 */
export function createLanguageModel(providerId?: string, modelId?: string): LanguageModel {
  return providerRegistry[resolveProviderId(providerId)].createModel(modelId);
}

/** The provider selected by DEFAULT_LLM_PROVIDER (defaults to OpenAI). */
export function getConfiguredProvider(): LlmProvider {
  return resolveProviderId(process.env.DEFAULT_LLM_PROVIDER);
}

/**
 * Legacy alias for {@link createLanguageModel}. Resolves from its argument only
 * (see the resolution-asymmetry note in the module header).
 */
export function getLanguageModel(provider?: string): LanguageModel {
  return createLanguageModel(provider);
}

/** Summarises every registered provider for the /health and /providers routes. */
export function listProviders() {
  return Object.values(providerRegistry).map((p) => ({
    provider: p.id,
    defaultModel: p.defaultModel,
    configured: p.isConfigured(),
  }));
}

/**
 * Legacy single-shot completion helper used by the /assist route.
 * Runs one non-streaming generation and echoes back the resolved provider.
 */
export async function completeWithLlm({ message, provider }: { message: string; provider?: string }) {
  const model = createLanguageModel(provider);
  const result = await generateText({
    model,
    prompt: message,
    temperature: config.llm.legacyCompletionTemperature,
  });
  return {
    model: String(model),
    provider: getConfiguredProvider(),
    response: result.text,
  };
}
