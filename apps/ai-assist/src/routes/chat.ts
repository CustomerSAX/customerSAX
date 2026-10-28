import { Router } from "express";
import { Readable } from "stream";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import type { UIMessage, SystemModelMessage } from "ai";
import { getLanguageModel } from "../llm/index.js";
import { config } from "../config.js";
import { buildDynamicPrompt, STATIC_SYSTEM_PROMPT, contextStorage } from "../chat/system-prompt.js";
import { buildChatTools } from "../chat/tools/index.js";
import type { SystemPromptContext } from "../chat/system-prompt.js";
import {
  loadOrCreateSession,
  appendSessionMessages,
  getSessionMessages,
  listSessions,
  renameSession,
  deleteSession,
} from "../db/mongo-chat.js";
import type { StoredMessage } from "../db/mongo-chat.js";
import { getWorkingMemory, setWorkingMemory, formatWorkingMemoryForPrompt } from "../memory/working-memory.js";
import { getEpisodicMemory, getCustomerMemory } from "../memory/episodic-memory.js";
import { incrementFixedWindow, aiChatRateLimit } from "@csa/cache";
import { createLogger } from "@csa/logger";
import { readCsaContext } from "@csa/headers";

const log = createLogger("ai-assist").child({ module: "chat" });

export const chatRouter = Router();

// ---------------------------------------------------------------------------
// Trusted identity — derived from x-csa-* headers set by the studio proxy
// ---------------------------------------------------------------------------
//
// The browser no longer talks to ai-assist directly. The studio's
// /api/chat/stream proxy validates the httpOnly session and forwards the
// authenticated identity as trusted x-csa-* headers. This service therefore
// derives userEmail / role / projectKey / clientId AND the ACL from those
// headers — never from the request body, which the client controls. When the
// role header is absent or unrecognized we fail closed (reads only, no writes).

/** Roles allowed to perform write actions. Anything else is read-only. */
function isWriterRole(role: string | undefined): boolean {
  const normalized = (role ?? "").trim().toLowerCase();
  return normalized === "agent" || normalized === "admin" || normalized === "superadmin";
}

/** Human-readable role label for the system prompt, derived from the trusted role. */
function roleDisplayLabel(role: string | undefined): string {
  switch ((role ?? "").trim().toLowerCase()) {
    case "admin":
      return "CSA Administrator";
    case "superadmin":
      return "CSA Super Administrator";
    case "agent":
      return "CSA Agent";
    default:
      // Fail-closed default — a benign label that pairs with reads-only ACL.
      return "Support Agent";
  }
}

// ---------------------------------------------------------------------------
// Per-user rate limiter — fixed window, Redis-backed (shared across instances)
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = config.chat.rateLimitMax;
const RATE_LIMIT_WINDOW_SECONDS = Math.ceil(config.chat.rateLimitWindowMs / 1000); // 1 hour

/**
 * Fixed-window rate limit via a shared Redis counter (`@csa/cache`), so the
 * limit holds across every ai-assist instance rather than per-process.
 *
 * DEGRADE-OPEN: when Redis is unavailable `incrementFixedWindow` returns null;
 * we allow the request rather than block on a cache outage — a rate limiter
 * must never take down the chat path.
 */
async function isRateLimited(key: string): Promise<boolean> {
  const count = await incrementFixedWindow(aiChatRateLimit(key), RATE_LIMIT_WINDOW_SECONDS);
  if (count === null) return false; // Redis down → degrade open (allow)
  return count > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a UIMessage's parts for history storage. */
function extractText(message: UIMessage): string {
  if (!message.parts?.length) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => (p as { type: string }).type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

/**
 * What the rep's latest message authorises. Only two UI actions are approvals:
 * the Approve click on an approval card (sent as `[approved-action] …`) and a
 * `return.confirm` hidden action (return stepper / refund card Confirm), which
 * names the one order it applies to. Anything else — typed text, other hidden
 * actions — authorises no commerce write.
 */
function approvalFromMessage(raw: unknown): SystemPromptContext["approval"] {
  const message = raw as Partial<UIMessage> | null | undefined;
  if (!message || message.role !== "user" || !Array.isArray(message.parts)) return null;
  const text = extractText(message as UIMessage);
  if (text.startsWith("[approved-action]")) return { kind: "approval_card" };
  const hidden = text.match(/^\[hidden-action\]\s*(\{[\s\S]*\})$/);
  if (hidden) {
    try {
      const action = JSON.parse(hidden[1]) as { type?: unknown; orderId?: unknown };
      if (action.type === "return.confirm" && typeof action.orderId === "string" && action.orderId.trim()) {
        return { kind: "return_confirm", orderId: action.orderId.trim() };
      }
    } catch {
      // Malformed hidden action — authorises nothing.
    }
  }
  return null;
}

/**
 * POST /chat
 *
 * Identity + ACL (userEmail/role/projectKey/clientId + can* flags) are derived
 * ONLY from the trusted x-csa-* headers set by the studio proxy — never from the
 * body. The body's `context` may still carry BENIGN presentation fields.
 *
 * Body:
 *   messages    : UIMessage[]  — full conversation from useChat hook
 *   context     : benign presentation context only — pageContext /
 *                               businessType / proactiveHint / vipThreshold.
 *                               Any identity/ACL here is ignored.
 *   sessionId   : string       — client-generated UUID; server creates the
 *                               MongoDB session if not found
 *   provider    : "openai" | "anthropic" — optional override
 *
 * Response: text/event-stream (UI message stream consumed by useChat)
 */
chatRouter.post("/chat", async (request, response, next) => {
  try {
    const { messages = [], context = {}, sessionId: incomingSessionId, provider } = request.body as {
      messages?: unknown[];
      context?: Partial<SystemPromptContext>;
      sessionId?: string;
      provider?: string;
    };

    // ── Trusted identity + ACL — from headers ONLY, never the body ─────────
    // The studio proxy validated the session and set these x-csa-* headers.
    // The body's `context` may still carry BENIGN presentation fields
    // (pageContext / businessType / proactiveHint / vipThreshold), but any
    // identity/ACL it contains is deliberately ignored — the client cannot be
    // trusted for its own identity or permissions.
    const csa = readCsaContext(request);
    const isWriter = isWriterRole(csa.userRole);

    const sessionCtx: SystemPromptContext = {
      userEmail: csa.userEmail?.trim() || "unknown@csa.local",
      userRole: roleDisplayLabel(csa.userRole),
      projectKey: csa.projectKey?.trim() || (process.env.COMMERCETOOLS_PROJECT_KEY ?? "default"),
      // Tenant id — carried through so the commerce path (bffQuery) can forward
      // x-csa-client-id and resolve provisioned multi-tenant projects. Absent
      // for the single-tenant/env path, which is unaffected.
      clientId: csa.clientId?.trim() || undefined,

      // Benign, non-identity presentation context — safe to take from the body.
      businessType: context.businessType ?? "b2c",
      pageContext: context.pageContext ?? null,
      proactiveHint: context.proactiveHint ?? null,
      vipThreshold: context.vipThreshold,
      workingMemoryBlock: null, // populated from Redis below

      // ACL — derived from the TRUSTED role header. Reads are always allowed
      // (data-layer project scoping is the real read boundary); writes are
      // granted only to writer roles. Absent/unknown role → reads only.
      canViewTickets: true,
      canCreateTickets: isWriter,
      canUpdateTickets: isWriter,
      canViewOrders: true,
      canCreateOrders: isWriter,
      canUpdateOrders: isWriter,
      canViewCustomers: true,
      canCreateCustomers: isWriter,
      canUpdateCustomers: isWriter,
      canViewCarts: true,
      canCreateCarts: isWriter,
      canUpdateCarts: isWriter,
      canViewProducts: true,

      // What the rep's latest message authorises — checked by the commerce
      // write tools themselves (see buildCommerceTools).
      approval: approvalFromMessage(messages.at(-1)),
    };

    const userEmail = sessionCtx.userEmail;
    const projectKey = sessionCtx.projectKey;

    // Rate-limit by userEmail so runaway clients can't spam the LLM
    if (await isRateLimited(userEmail)) {
      response.status(429).json({ error: "Rate limit exceeded — please wait before sending more messages." });
      return;
    }

    // ── Session persistence ────────────────────────────────────────────────
    // The client provides a stable UUID for its current conversation. We load
    // or create a MongoDB session for it. Non-fatal: if MongoDB is unavailable,
    // the chat still works; the History panel just won't show this session.
    let sessionId = incomingSessionId?.trim() ?? crypto.randomUUID();
    let session: Awaited<ReturnType<typeof loadOrCreateSession>> | null = null;

    try {
      session = await loadOrCreateSession(
        sessionId,
        userEmail,
        projectKey,
        sessionCtx.clientId,
        sessionCtx.pageContext
      );
      sessionId = session.sessionId; // use what the store returned (same UUID)

      // Persist the user's incoming message immediately so that server restarts,
      // client disconnects, or stream cancellations do not lose the user turn.
      const uiMessages = messages as UIMessage[];
      const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const userText = extractText(lastUserMsg);
        if (userText) {
          await appendSessionMessages(
            sessionId,
            [
              {
                id: lastUserMsg.id ?? crypto.randomUUID(),
                role: "user",
                content: userText,
                createdAt: new Date().toISOString(),
              },
            ],
            sessionCtx.clientId
          );
        }
      }
    } catch (err) {
      log.error("session load/create or initial user message save failed (non-fatal)", err);
    }

    // ── Working memory — inject previous turn's context ────────────────────
    // Load working memory from Redis (if configured), format it as a prompt
    // block, and inject into the dynamic system prompt before this turn runs.
    // Non-fatal: if Redis is unavailable, workingMemoryBlock stays empty and
    // the turn proceeds normally without any injected context.
    const wmRecord = await getWorkingMemory(sessionId);
    const workingMemoryBlock = formatWorkingMemoryForPrompt(wmRecord);

    // Merge the working memory block into the session context so
    // buildDynamicPrompt can embed it in the per-turn prompt section.
    const contextWithMemory: SystemPromptContext = {
      ...sessionCtx,
      workingMemoryBlock,
    };

    // ── Two-block caching pattern (Anthropic prompt caching) ──────────────
    // STATIC_SYSTEM_PROMPT is identical every request → Anthropic caches it
    // after the first call, cutting input token cost by 60–70%.
    // buildDynamicPrompt() is per-request (user, date, page, memory) → never cached.
    //
    // SystemModelMessage format (AI SDK v6):
    //   { role: 'system', content: string, providerOptions?: ProviderOptions }
    const systemPromptBlocks: SystemModelMessage[] = [
      {
        role: "system",
        content: STATIC_SYSTEM_PROMPT,
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
      {
        role: "system",
        content: `\n\n---\n\n${buildDynamicPrompt(contextWithMemory)}`,
      },
    ];

    const model = getLanguageModel(provider);
    const chatTools = buildChatTools();

    // Convert UIMessage[] (from @ai-sdk/react client) → ModelMessage[] (for streamText)
    const modelMessages = await convertToModelMessages(messages as UIMessage[]);

    const result = await contextStorage.run(sessionCtx, () => {
      return streamText({
        model,
        system: systemPromptBlocks,
        messages: modelMessages,
        tools: chatTools,
        stopWhen: [
          stepCountIs(config.chat.maxAgenticSteps),
          // Defence-in-depth: stop the multi-step loop after any step that
          // contained an action_approval tool call, so the model cannot call a
          // write tool in the *following* step of the same request.
          // (The per-request approvalGate blocks writes that happen in the
          // *same* step as action_approval — this condition handles the case
          // where they arrive in separate steps.)
          ({ steps }) => {
            const last = steps.at(-1);
            const results = (last?.toolResults ?? []) as Array<{ toolName: string }>;
            return results.some((tr) => tr.toolName === "action_approval");
          },
        ],
        temperature: config.llm.chatTemperature,
        onError: async (event) => {
          log.error("streamText error", event.error);
          try {
            if (session) {
              await appendSessionMessages(
                session.sessionId,
                [
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "An interruption occurred while generating this response. You can continue or retry your prompt.",
                    createdAt: new Date().toISOString(),
                  },
                ],
                sessionCtx.clientId
              );
            }
          } catch {
            // non-fatal
          }
        },
        onFinish: async ({ steps }) => {
          // Persist this turn to MongoDB so the History panel can display it.
          // Also persist working memory so the next turn has context continuity.
          // Both are non-fatal: errors here must never break the streaming response.

          // ── Working memory — extract update_ui_state tool call ─────────
          // Scan all tool calls across steps for the first update_ui_state result,
          // then write its fields to Redis so the next turn can inject them.
          try {
            for (const step of steps) {
              const uiStateCall = step.toolCalls?.find?.(
                (tc: { toolName: string }) => tc.toolName === "update_ui_state"
              ) as { args?: { goal?: string; sentiment?: string; strategy?: string; nextSteps?: string[] } } | undefined;

              if (uiStateCall?.args) {
                const { goal, sentiment, strategy, nextSteps } = uiStateCall.args;
                await setWorkingMemory(sessionId, {
                  activeGoal: goal ?? null,
                  currentSentiment: sentiment ?? null,
                  currentStrategy: strategy ?? null,
                  nextSteps: Array.isArray(nextSteps) ? nextSteps : [],
                  lastUpdated: new Date().toISOString(),
                });
                break; // first update_ui_state call wins
              }
            }
          } catch (err) {
            log.warn("working memory persist failed (non-fatal)", { reason: (err as Error).message });
          }

          // ── Session persistence — append assistant response & tool outcomes ──
          if (!session) return;

          try {
            const newMessages: StoredMessage[] = [];

            // Assistant turn — concatenate text from all steps
            let assistantText = steps
              .map((s) => s.text ?? "")
              .filter(Boolean)
              .join(" ")
              .trim();

            // If assistantText is empty but tool calls took place (e.g. action_approval),
            // construct a readable summary so the conversation history reflects what occurred.
            if (!assistantText) {
              const allToolCalls = steps.flatMap((s) => s.toolCalls ?? []);
              const approvalCall = allToolCalls.find((tc) => tc.toolName === "action_approval") as
                | { args?: { actionTitle?: string; description?: string } }
                | undefined;
              if (approvalCall?.args) {
                const title = approvalCall.args.actionTitle || "Action proposed";
                const desc = approvalCall.args.description || "";
                assistantText = `[Proposed Action: ${title}] ${desc}`.trim();
              } else if (allToolCalls.length > 0) {
                const names = allToolCalls.map((tc) => tc.toolName).join(", ");
                assistantText = `Processed operations: ${names}`;
              }
            }

            if (assistantText) {
              newMessages.push({
                id: crypto.randomUUID(),
                role: "assistant",
                content: assistantText,
                createdAt: new Date().toISOString(),
              });
            }

            if (newMessages.length > 0) {
              await appendSessionMessages(session.sessionId, newMessages, sessionCtx.clientId);
            }
          } catch (err) {
            log.error("onFinish persistence failed (non-fatal)", err);
          }
        }
      });
    });

    // Bridge Fetch API Response → Express response
    const webResponse = result.toUIMessageStreamResponse();

    response.status(webResponse.status);
    // Expose sessionId so clients can capture it from the response header
    response.setHeader("x-session-id", sessionId);
    response.setHeader("Access-Control-Expose-Headers", "x-session-id");
    webResponse.headers.forEach((value: string, key: string) => {
      if (key.toLowerCase() === "content-length") return; // let Node compute it
      response.setHeader(key, value);
    });

    const nodeStream = Readable.fromWeb(webResponse.body as import("stream/web").ReadableStream);
    nodeStream.pipe(response);

    // Clean up on client disconnect
    response.on("close", () => {
      nodeStream.destroy();
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /chat — restore messages for a session (used by History panel)
// ---------------------------------------------------------------------------

chatRouter.get("/chat", async (request, response, next) => {
  try {
    const sessionId = (request.query.sessionId as string | undefined)?.trim();
    // IDOR fix: userEmail & clientId derived from TRUSTED x-csa-* headers
    const trusted = readCsaContext(request);
    const userEmail = trusted.userEmail?.trim() ?? "";
    const clientId = trusted.clientId?.trim() || undefined;

    if (!sessionId || !userEmail) {
      response.status(400).json({ error: "sessionId and authenticated identity are required" });
      return;
    }

    const messages = await getSessionMessages(sessionId, userEmail, clientId);
    response.json({ messages });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /sessions — list sessions for the History panel
// ---------------------------------------------------------------------------

chatRouter.get("/sessions", async (request, response, next) => {
  try {
    // IDOR fix: identity comes from the TRUSTED x-csa-* headers set by the
    // studio proxy, not client-supplied query params.
    const trusted = readCsaContext(request);
    const userEmail = trusted.userEmail?.trim() ?? "";
    const projectKey = trusted.projectKey?.trim() ?? "";
    const clientId = trusted.clientId?.trim() || undefined;
    const limit = Math.min(Number(request.query.limit ?? 30), 100);
    const skip = Math.max(Number(request.query.skip ?? 0), 0);

    if (!userEmail) {
      response.status(400).json({ error: "authenticated identity is required" });
      return;
    }

    const result = await listSessions(userEmail, projectKey, clientId, limit, skip);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PATCH /sessions — rename a session with ownership and tenant validation
// ---------------------------------------------------------------------------

chatRouter.patch("/sessions", async (request, response, next) => {
  try {
    const trusted = readCsaContext(request);
    const userEmail = trusted.userEmail?.trim() ?? "";
    const clientId = trusted.clientId?.trim() || undefined;
    const sessionId =
      (request.query.sessionId as string | undefined)?.trim() ||
      (request.body as { sessionId?: string })?.sessionId?.trim();
    const title = (request.body as { title?: string })?.title?.trim();

    if (!sessionId || !title || !userEmail) {
      response.status(400).json({ error: "sessionId, title, and authenticated identity are required" });
      return;
    }

    const ok = await renameSession(sessionId, userEmail, clientId, title);
    if (!ok) {
      response.status(404).json({ error: "Session not found or unauthorized" });
      return;
    }
    response.json({ success: true, sessionId, title });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /sessions — delete a session with ownership and tenant validation
// ---------------------------------------------------------------------------

chatRouter.delete("/sessions", async (request, response, next) => {
  try {
    const trusted = readCsaContext(request);
    const userEmail = trusted.userEmail?.trim() ?? "";
    const clientId = trusted.clientId?.trim() || undefined;
    const sessionId =
      (request.query.sessionId as string | undefined)?.trim() ||
      (request.body as { sessionId?: string })?.sessionId?.trim();

    if (!sessionId || !userEmail) {
      response.status(400).json({ error: "sessionId and authenticated identity are required" });
      return;
    }

    const ok = await deleteSession(sessionId, userEmail, clientId);
    if (!ok) {
      response.status(404).json({ error: "Session not found or unauthorized" });
      return;
    }
    response.json({ success: true, sessionId });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /memory — aggregate working + episodic memory for the sidebar Memory tab
// ---------------------------------------------------------------------------

/**
 * GET /memory?sessionId=<id>&customerId=<id>&userEmail=<email>&projectKey=<key>
 *
 * Returns the two-tier memory state for a session and/or customer:
 *   - workingMemory: Redis hash for the active session (goal/intent/sentiment/strategy)
 *   - episodicMemory: MongoDB entries scoped to the customer and agent
 *
 * All params are optional — missing ones simply skip the corresponding lookup.
 * Non-fatal: Redis/MongoDB unavailability returns null/[] rather than 5xx.
 */
chatRouter.get("/memory", async (request, response, next) => {
  try {
    // Identity (userEmail/projectKey) is derived from the TRUSTED x-csa-*
    // headers set by the studio proxy, not client-supplied query params, so a
    // caller cannot read another agent's episodic memory via ?userEmail=.
    const trusted     = readCsaContext(request);
    const sessionId   = (request.query.sessionId   as string | undefined)?.trim() ?? "";
    const customerId  = (request.query.customerId  as string | undefined)?.trim() ?? "";
    const userEmail   = trusted.userEmail?.trim() ?? "";
    const projectKey  = trusted.projectKey?.trim() ?? "";
    const customerName  = (request.query.customerName  as string | undefined)?.trim() ?? "";
    const customerEmail = (request.query.customerEmail as string | undefined)?.trim() ?? "";

    const [workingMemory, episodicCustomerRaw, agentHistoryRaw] = await Promise.all([
      sessionId ? getWorkingMemory(sessionId) : Promise.resolve(null),
      customerId ? getCustomerMemory(customerId, projectKey, 10) : Promise.resolve([]),
      userEmail  ? getEpisodicMemory(userEmail, projectKey, 20)  : Promise.resolve([]),
    ]);

    // Merge customer-scoped and agent-history entries, deduplicating by summary.
    const episodicMemoryRaw = [...episodicCustomerRaw];
    const nameLower  = customerName.toLowerCase();
    const emailLower = customerEmail.toLowerCase();

    if ((nameLower && nameLower !== "unknown customer") || emailLower) {
      // Fill in from agent history for entries that match the customer by name/email.
      const fallbackMatches = agentHistoryRaw.filter((entry) => {
        const summary = entry.summary.toLowerCase();
        const matchesName  = nameLower  && nameLower !== "unknown customer" && summary.includes(nameLower);
        const matchesEmail = emailLower && summary.includes(emailLower);
        return matchesName || matchesEmail;
      });
      for (const match of fallbackMatches) {
        if (!episodicMemoryRaw.some((e) => e.summary === match.summary)) {
          episodicMemoryRaw.push(match);
        }
      }
    } else if (!customerId) {
      // No customer identity at all — return generic agent history.
      episodicMemoryRaw.push(...agentHistoryRaw);
    }

    // Always sort newest first.
    episodicMemoryRaw.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    response.json({ workingMemory, episodicMemory: episodicMemoryRaw });
  } catch (error) {
    next(error);
  }
});
