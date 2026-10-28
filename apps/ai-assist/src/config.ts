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

  /** Order returns. */
  returns: {
    /**
     * Days after the order date within which a return is allowed
     * (env: RETURN_WINDOW_DAYS, default 30). Raise it locally to test returns
     * on older orders; production keeps the default unless deliberately set.
     */
    windowDays: envInt("RETURN_WINDOW_DAYS", 30),
  },

  /** Public voice widget (/voice/*) limits. Tenants come from VOICE_WIDGET_TENANTS (see voice/tenants.ts). */
  voice: {
    /** New voice sessions per client IP per hour (env: VOICE_SESSION_RATE_LIMIT). */
    sessionRateLimitPerIp: envInt("VOICE_SESSION_RATE_LIMIT", 20),
    /** New voice sessions per widget tenant per hour — backstop for spoofed/rotating IPs (env: VOICE_TENANT_SESSION_LIMIT). */
    sessionRateLimitPerTenant: envInt("VOICE_TENANT_SESSION_LIMIT", 500),
    /** Caller turns per session; bounds LLM spend per conversation (env: VOICE_MAX_TURNS). */
    maxTurns: envInt("VOICE_MAX_TURNS", 40),
    /** Max characters of recognised speech accepted per turn. */
    maxTurnChars: 500,
    /** Agentic steps per turn (tool calls + reply). */
    maxStepsPerTurn: 6,
    /** Serve GET /voice/demo — on by default outside production (env: VOICE_DEMO_ENABLED=true|false). */
    demoEnabled:
      process.env.VOICE_DEMO_ENABLED !== undefined
        ? process.env.VOICE_DEMO_ENABLED === "true"
        : process.env.NODE_ENV !== "production" && !process.env.K_SERVICE,
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
