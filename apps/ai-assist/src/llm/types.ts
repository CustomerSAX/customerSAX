/**
 * Shared types for the LLM provider factory/registry.
 *
 * These describe the contract every language-model provider must satisfy so the
 * factory (`src/llm/index.ts`) can treat OpenAI, Anthropic, and any future
 * backend uniformly — selecting one by id without knowing its internals.
 */

import type { LanguageModel } from "ai";

/** Identifiers of the providers wired into the registry. */
export type LlmProvider = "openai" | "anthropic";

/**
 * A self-describing language-model provider.
 *
 * Each concrete provider (see `src/llm/registry.ts`) implements this so the
 * factory can build a model, report configuration status to the /health and
 * /providers routes, and label the provider in diagnostics — all through one
 * uniform shape.
 */
export interface LlmProviderDefinition {
  /** Stable machine id, e.g. `"openai"`. Matches the registry map key. */
  id: string;
  /** Human-readable name for diagnostics/UX, e.g. `"OpenAI"`. */
  label: string;
  /**
   * Builds a concrete `LanguageModel`.
   * @param modelId Optional explicit model id; falls back to `defaultModel`.
   */
  createModel(modelId?: string): LanguageModel;
  /** The provider's default model id (honours its env override). */
  defaultModel: string;
  /** True when the provider has the credentials it needs to run. */
  isConfigured(): boolean;
}
