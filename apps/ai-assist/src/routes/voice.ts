/**
 * Public voice agent endpoints — called directly by the embeddable widget on a
 * merchant's site (not through the studio proxy, and with no rep session).
 *
 * Speech never reaches this service: the browser's own speech recognition
 * turns the caller's voice into text and its speech synthesis reads replies
 * aloud. Each caller utterance is one POST /voice/turn, answered as SSE:
 *
 *   event: delta   data: {"text": "..."}          streamed reply text
 *   event: status  data: {"type": "verified"}      | {"type":"ticket","ticketNumber"} | {"type":"ended"}
 *   event: done    data: {"ended": boolean}
 *   event: error   data: {"message": "..."}
 *
 * Mounted at /voice in src/index.ts BEFORE the global CORS middleware, because
 * these routes allow each tenant's own origins rather than the studio origin.
 */

import { Router, json } from "express";
import type { Request, Response } from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { z } from "zod";
import { incrementFixedWindow } from "@csa/cache";
import { createLogger } from "@csa/logger";
import { getLanguageModel } from "../llm/index.js";
import { config } from "../config.js";
import { contextStorage } from "../chat/system-prompt.js";
import type { SystemPromptContext } from "../chat/system-prompt.js";
import { isKnownOrigin, resolveTenant } from "../voice/tenants.js";
import type { VoiceTenant } from "../voice/tenants.js";
import {
  VoiceStoreUnavailableError,
  acquireTurnLock,
  archiveSession,
  loadSession,
  newSessionId,
  releaseTurnLock,
  saveSession
} from "../voice/voice-session.js";
import type { VoiceSession } from "../voice/voice-session.js";
import { buildVoiceTools } from "../voice/voice-tools.js";
import type { VoiceStatusEvent } from "../voice/voice-tools.js";
import { buildGreeting, buildVoicePrompt } from "../voice/voice-prompt.js";

const log = createLogger("ai-assist").child({ module: "voice" });

export const voiceRouter = Router();

const RATE_WINDOW_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// CORS — per-tenant origins. Preflights can't carry the widget key, so they
// pass for any configured tenant origin; each real request then re-checks the
// origin against ITS tenant.
// ---------------------------------------------------------------------------

voiceRouter.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && isKnownOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Max-Age", "600");
  }
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});

voiceRouter.use(json({ limit: "8kb" }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Client IP for rate limiting. Behind Cloud Run the left-most X-Forwarded-For
 * entry is the client as reported upstream; it can be spoofed, which is why a
 * per-tenant cap backs this limit up.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || request.socket.remoteAddress || "unknown";
}

/** Fixed-window limit. Redis down → allowed (in production the session store itself then refuses). */
async function overLimit(key: string, max: number): Promise<boolean> {
  const count = await incrementFixedWindow(key, RATE_WINDOW_SECONDS);
  return count !== null && count > max;
}

/** Tools run as the tenant's service identity: reads only, no chat write permissions. */
function voiceContext(tenant: VoiceTenant): SystemPromptContext {
  return {
    userEmail: tenant.serviceEmail,
    userRole: "voice-agent",
    projectKey: tenant.projectKey,
    clientId: tenant.clientId,
    canViewTickets: false,
    canCreateTickets: false,
    canUpdateTickets: false,
    canViewOrders: true,
    canCreateOrders: false,
    canUpdateOrders: false,
    canViewCustomers: false,
    canCreateCustomers: false,
    canUpdateCustomers: false,
    canViewCarts: false,
    canCreateCarts: false,
    canUpdateCarts: false,
    canViewProducts: false
  };
}

function sendEvent(response: Response, event: string, data: unknown): void {
  if (!response.writableEnded) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function storeUnavailable(response: Response): void {
  response.status(503).json({ error: "voice_unavailable" });
}

/** Loads a session and re-resolves its tenant against the request origin. */
async function loadForRequest(
  request: Request,
  sessionId: string
): Promise<{ session: VoiceSession; tenant: VoiceTenant } | { status: number; error: string }> {
  const session = await loadSession(sessionId);
  if (!session) return { status: 404, error: "session_expired" };
  const resolved = resolveTenant(session.widgetKey, request.headers.origin);
  if (!resolved.ok) return { status: 403, error: resolved.reason };
  return { session, tenant: resolved.tenant };
}

// ---------------------------------------------------------------------------
// POST /voice/session — start a conversation
// ---------------------------------------------------------------------------

const sessionBody = z.object({ widgetKey: z.string().min(16).max(128) });

voiceRouter.post("/session", async (request, response) => {
  const body = sessionBody.safeParse(request.body);
  if (!body.success) {
    response.status(400).json({ error: "invalid_request" });
    return;
  }
  const resolved = resolveTenant(body.data.widgetKey, request.headers.origin);
  if (!resolved.ok) {
    log.warn("voice session refused", { reason: resolved.reason });
    response.status(resolved.status).json({ error: resolved.reason });
    return;
  }
  const { tenant } = resolved;

  if (
    (await overLimit(`ai:voice:session:ip:${clientIp(request)}`, config.voice.sessionRateLimitPerIp)) ||
    (await overLimit(`ai:voice:session:tenant:${tenant.widgetKey}`, config.voice.sessionRateLimitPerTenant))
  ) {
    response.status(429).json({ error: "rate_limited" });
    return;
  }

  const now = new Date().toISOString();
  const greeting = buildGreeting(tenant);
  const session: VoiceSession = {
    id: newSessionId(),
    widgetKey: tenant.widgetKey,
    projectKey: tenant.projectKey,
    clientId: tenant.clientId,
    createdAt: now,
    updatedAt: now,
    transcript: [{ role: "assistant", text: greeting, at: now }],
    verified: null,
    verifyAttempts: 0,
    turns: 0,
    toolEvents: [],
    ticket: null,
    ended: false,
    outcome: "in_progress"
  };

  try {
    await saveSession(session);
  } catch (err) {
    if (err instanceof VoiceStoreUnavailableError) return storeUnavailable(response);
    throw err;
  }
  void archiveSession(session);
  log.info("voice session started", { projectKey: tenant.projectKey });
  response.json({ sessionId: session.id, greeting, lang: tenant.lang, maxTurns: config.voice.maxTurns });
});

// ---------------------------------------------------------------------------
// POST /voice/turn — one caller utterance → streamed spoken reply
// ---------------------------------------------------------------------------

const turnBody = z.object({
  sessionId: z.string().min(20).max(100),
  text: z.string().trim().min(1).max(config.voice.maxTurnChars)
});

voiceRouter.post("/turn", async (request, response) => {
  const body = turnBody.safeParse(request.body);
  if (!body.success) {
    response.status(400).json({ error: "invalid_request" });
    return;
  }
  const { sessionId, text } = body.data;

  let loaded: Awaited<ReturnType<typeof loadForRequest>>;
  try {
    loaded = await loadForRequest(request, sessionId);
  } catch (err) {
    if (err instanceof VoiceStoreUnavailableError) return storeUnavailable(response);
    throw err;
  }
  if ("error" in loaded) {
    response.status(loaded.status).json({ error: loaded.error });
    return;
  }
  const { tenant } = loaded;
  let session = loaded.session;

  if (session.ended) {
    response.status(409).json({ error: "session_ended" });
    return;
  }
  if (session.turns >= config.voice.maxTurns) {
    response.status(429).json({ error: "turn_limit" });
    return;
  }
  if (!(await acquireTurnLock(sessionId))) {
    response.status(409).json({ error: "turn_in_progress" });
    return;
  }

  try {
    // Re-read under the lock so counters reflect any turn that just finished.
    session = (await loadSession(sessionId)) ?? session;
    session.turns += 1;
    session.transcript.push({ role: "user", text, at: new Date().toISOString() });

    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const abort = new AbortController();
    response.on("close", () => {
      if (!response.writableEnded) abort.abort();
    });

    const emit = (event: VoiceStatusEvent) => sendEvent(response, "status", event);
    const tools = buildVoiceTools(session, tenant, emit);
    const messages: ModelMessage[] = session.transcript.map((t) => ({ role: t.role, content: t.text }));

    let reply = "";
    let failed = false;
    await contextStorage.run(voiceContext(tenant), async () => {
      const result = streamText({
        model: getLanguageModel(),
        system: buildVoicePrompt(tenant, session),
        messages,
        tools,
        temperature: config.llm.chatTemperature,
        stopWhen: stepCountIs(config.voice.maxStepsPerTurn),
        abortSignal: abort.signal,
        onError: ({ error }) => {
          failed = true;
          log.error("voice turn stream error", error);
        }
      });
      for await (const part of result.fullStream) {
        if (part.type === "text-start" && reply && !/\s$/.test(reply)) {
          // Text from a later step (after a tool call) would otherwise run
          // straight into the previous sentence: "…for you.I couldn't…".
          reply += " ";
          sendEvent(response, "delta", { text: " " });
        } else if (part.type === "text-delta") {
          reply += part.text;
          sendEvent(response, "delta", { text: part.text });
        }
      }
    });

    if (!reply.trim() && failed && !abort.signal.aborted) {
      // An honest failure message, not a made-up answer.
      reply = "Sorry, I'm having trouble right now. Please try again in a moment.";
      sendEvent(response, "error", { message: reply });
    }
    if (reply.trim()) {
      session.transcript.push({ role: "assistant", text: reply.trim(), at: new Date().toISOString() });
    }

    await saveSession(session);
    void archiveSession(session);
    sendEvent(response, "done", { ended: session.ended });
    response.end();
  } catch (err) {
    log.error("voice turn failed", err);
    if (!response.headersSent) {
      if (err instanceof VoiceStoreUnavailableError) storeUnavailable(response);
      else response.status(500).json({ error: "turn_failed" });
    } else {
      sendEvent(response, "error", { message: "Sorry, something went wrong on our side." });
      response.end();
    }
  } finally {
    await releaseTurnLock(sessionId);
  }
});

// ---------------------------------------------------------------------------
// POST /voice/end — caller hung up
// ---------------------------------------------------------------------------

voiceRouter.post("/end", async (request, response) => {
  const body = z.object({ sessionId: z.string().min(20).max(100) }).safeParse(request.body);
  if (!body.success) {
    response.status(400).json({ error: "invalid_request" });
    return;
  }
  try {
    const loaded = await loadForRequest(request, body.data.sessionId);
    if ("error" in loaded) {
      response.status(loaded.status).json({ error: loaded.error });
      return;
    }
    const { session } = loaded;
    if (!session.ended) {
      session.ended = true;
      if (session.outcome === "in_progress") session.outcome = "abandoned";
      await saveSession(session);
      await archiveSession(session);
    }
    response.json({ ended: true });
  } catch (err) {
    if (err instanceof VoiceStoreUnavailableError) return storeUnavailable(response);
    throw err;
  }
});

// ---------------------------------------------------------------------------
// GET /voice/widget.js — the embeddable widget bundle (apps/voice-widget)
// ---------------------------------------------------------------------------

const widgetBundlePath =
  process.env.VOICE_WIDGET_BUNDLE?.trim() ||
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../voice-widget/dist/csa-voice.js");

voiceRouter.get("/widget.js", (_request, response) => {
  if (!existsSync(widgetBundlePath)) {
    log.error("voice widget bundle missing — run `pnpm --filter @csa/voice-widget build`", undefined, { widgetBundlePath });
    response.status(404).type("text/plain").send("voice widget not built");
    return;
  }
  response.setHeader("Cache-Control", "public, max-age=300");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.type("application/javascript").sendFile(widgetBundlePath);
});

// ---------------------------------------------------------------------------
// GET /voice/demo?key=… — a bare host page for testing the widget
// ---------------------------------------------------------------------------

voiceRouter.get("/demo", (request, response) => {
  if (!config.voice.demoEnabled) {
    response.status(404).end();
    return;
  }
  const key = typeof request.query.key === "string" ? request.query.key : "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    response.status(400).type("text/plain").send("Pass ?key=<widget key> (16-128 chars, letters, digits, _ or -).");
    return;
  }
  response.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice widget demo</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 32px 16px; font: 16px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
  main { max-width: 640px; margin: 0 auto; }
</style>
</head>
<body>
<main>
  <h1>Voice widget test page</h1>
  <p>This page stands in for a merchant storefront. Use the "Talk to us" button in the corner. This page's origin must be listed in the widget key's <code>allowedOrigins</code>.</p>
</main>
<script src="/voice/widget.js" data-widget-key="${key}" defer></script>
</body>
</html>`);
});
