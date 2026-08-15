/**
 * Concrete LLM provider definitions and the registry that indexes them.
 *
 * WHY A REGISTRY
 * --------------
 * The factory in `index.ts` selects a provider by id and never branches on
 * provider-specific logic. All that logic — how a model is constructed, which
 * env var holds its credentials, its default model id — is encapsulated in a
 * `LlmProviderDefinition` here. Adding a provider is a matter of adding one
 * entry to `providerRegistry`; no caller changes.
 *
 * ANTHROPIC IS AN OPTIONAL PEER DEPENDENCY
 * ----------------------------------------
 * `@ai-sdk/anthropic` is not a declared dependency of this service, so it may be
 * absent at runtime. The Anthropic provider therefore loads it through a guarded
 * `createRequire` import (synchronous, so the factory's signature stays sync)
 * and, if the module is missing or model construction fails for any reason,
 * degrades gracefully to the OpenAI provider. This preserves the long-standing
 * behaviour whereby a deployment can point at Anthropic yet still function when
 * only the OpenAI SDK is installed.
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { createRequire } from "node:module";
import { config } from "../config.js";
import type { LlmProviderDefinition } from "./types.js";

/**
 * ESM-safe synchronous require. Used only to optionally load the Anthropic SDK
 * at runtime; keeps the factory synchronous (a dynamic `await import` would
 * force every caller of `getLanguageModel` to become async).
 */
const requireOptional = createRequire(import.meta.url);

/** Minimal structural type of the Anthropic SDK's factory export. */
type CreateAnthropic = (opts: { apiKey?: string }) => (modelId: string) => LanguageModel;

/**
 * Attempts to load `@ai-sdk/anthropic`. Returns its `createAnthropic` factory,
 * or `null` when the package is not installed.
 */
function loadAnthropicFactory(): CreateAnthropic | null {
  try {
    const mod = requireOptional("@ai-sdk/anthropic") as { createAnthropic: CreateAnthropic };
    return mod.createAnthropic;
  } catch {
    return null;
  }
}

/** Strip a leading `"<provider>/"` prefix from a model id, if present. */
function stripPrefix(modelId: string, provider: string): string {
  return modelId.replace(new RegExp(`^${provider}/`), "");
}

// Single OpenAI client instance, reused across model constructions.
const openaiClient = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const openaiProvider: LlmProviderDefinition = {
  id: "openai",
  label: "OpenAI",
  get defaultModel() {
    return config.llm.openaiModel;
  },
  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  },
  createModel(modelId?: string): LanguageModel {
    const model = stripPrefix(modelId ?? config.llm.openaiModel, "openai");
    return openaiClient(model);
  },
};

const anthropicProvider: LlmProviderDefinition = {
  id: "anthropic",
  label: "Anthropic",
  get defaultModel() {
    return config.llm.anthropicModel;
  },
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
  createModel(modelId?: string): LanguageModel {
    // Guarded: any failure to load the SDK or build the model falls back to
    // OpenAI so the service keeps responding. Behaviour preserved verbatim.
    try {
      const createAnthropic = loadAnthropicFactory();
      if (!createAnthropic) throw new Error("@ai-sdk/anthropic not installed");
      const client = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const model = stripPrefix(modelId ?? config.llm.anthropicModel, "anthropic");
      return client(model);
    } catch {
      console.warn("[llm] @ai-sdk/anthropic not available, falling back to OpenAI");
      return openaiProvider.createModel();
    }
  },
};

/**
 * The provider registry — keyed by provider id. Insertion order (openai first)
 * is the order surfaced by `listProviders()`.
 */
export const providerRegistry: Record<string, LlmProviderDefinition> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
};
