/**
 * Centralised runtime configuration for the ai-assist service.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Operational constants (model ids, the per-user rate limit, the agentic step
 * cap, response-truncation limits) were previously scattered as inline literals
 * across the LLM layer, the chat route, and the commerce client. That made them
 * hard to audit, impossible to tune without a code change, and easy to drift out
 * of sync with one another. This module is the single, documented source of
 * truth: every tunable value is read here once, with its environment-variable
 * override and its default in one place.
 *
 * Values are resolved at module load. `src/index.ts` loads `.env` before any
 * route (and therefore this module) is imported, so `process.env` is fully
 * populated by the time these expressions evaluate. The running service does not
 * mutate its own environment, so load-time resolution is behaviourally identical
 * to the previous read-at-call-site pattern.
 *
 * IMPORTANT: the defaults here intentionally reproduce the exact values that
 * used to be inlined. Changing a default changes production behaviour.
 */

import { envInt } from "@csa/config";

export const config = {
  /** Language-model provider and generation settings. */
  llm: {
    /** Default OpenAI model id (env: OPENAI_MODEL). */
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o",
    /** Default Anthropic model id (env: ANTHROPIC_MODEL). */
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    /**
     * Provider selected when a request does not specify one and no explicit
     * override applies (env: DEFAULT_LLM_PROVIDER). Informational — the actual
     * resolution logic lives in `resolveProviderId()` in `src/llm/index.ts`.
     */
    defaultProvider: process.env.DEFAULT_LLM_PROVIDER ?? "openai",
    /** Sampling temperature for the interactive /chat stream. */
    chatTemperature: 0.3,
    /** Sampling temperature for the legacy /assist single-shot completion. */
    legacyCompletionTemperature: 0,
  },

  /** Interactive /chat endpoint behaviour. */
  chat: {
    /**
     * Maximum chat requests per user within the sliding rate-limit window
     * (env: CHAT_RATE_LIMIT_MAX). Guards the LLM budget against runaway clients.
     */
    rateLimitMax: envInt("CHAT_RATE_LIMIT_MAX", 60),
    /** Sliding rate-limit window length, in milliseconds (1 hour). */
    rateLimitWindowMs: 60 * 60 * 1_000,
    /**
     * Hard cap on agentic steps (tool-call loops) within a single streamed
     * turn, passed to the AI SDK's `stepCountIs`. Prevents an unbounded
     * tool-calling loop from exhausting the request.
     */
    maxAgenticSteps: 20,
  },

  /** Commerce (BFF) client behaviour. */
  commerce: {
    /**
     * Number of characters of a failed BFF response body to include in the
     * surfaced error message. Keeps logs/errors readable while still capturing
     * enough of the upstream failure to diagnose it.
     */
    errorBodyPreviewChars: 200,
  },
} as const;

export type AppConfig = typeof config;
