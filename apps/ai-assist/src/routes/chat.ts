import { Router } from "express";
import { Readable } from "stream";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import type { UIMessage, SystemModelMessage } from "ai";
import { getLanguageModel } from "../llm/index.js";
import { buildDynamicPrompt, STATIC_SYSTEM_PROMPT, contextStorage } from "../chat/system-prompt.js";
import { buildChatTools } from "../chat/tools/index.js";
import type { SystemPromptContext } from "../chat/system-prompt.js";
import { loadOrCreateSession, appendSessionMessages, getSessionMessages, listSessions } from "../db/mongo-chat.js";
import type { StoredMessage } from "../db/mongo-chat.js";
import { getWorkingMemory, setWorkingMemory, formatWorkingMemoryForPrompt } from "../memory/working-memory.js";
import { getEpisodicMemory, getCustomerMemory } from "../memory/episodic-memory.js";

export const chatRouter = Router();

// ---------------------------------------------------------------------------
// Per-session rate limiter — sliding window, in-process
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX) || 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000; // 1 hour
const rateLimitStore = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitStore.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return false;
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
 * POST /chat
 *
 * Body:
 *   messages    : UIMessage[]  — full conversation from useChat hook
 *   context     : SystemPromptContext partial — session/page/ACL context
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

    // Build session context with sensible defaults
    const sessionCtx: SystemPromptContext = {
      userEmail: context.userEmail ?? "agent@csa.local",
      userRole: context.userRole ?? "Support Agent",
      projectKey: context.projectKey ?? (process.env.COMMERCETOOLS_PROJECT_KEY ?? "default"),
      businessType: context.businessType ?? "b2c",
      pageContext: context.pageContext ?? null,
      proactiveHint: context.proactiveHint ?? null,
      workingMemoryBlock: context.workingMemoryBlock ?? null,

      // ACL — reads default true, writes default false (principle of least privilege).
      // The webapp is expected to send explicit permission flags derived from the
      // authenticated user's role. Defaults here only apply if the webapp omits
      // a flag, which should not happen for a real authenticated session.
      canViewTickets: context.canViewTickets ?? true,
      canCreateTickets: context.canCreateTickets ?? false,
      canUpdateTickets: context.canUpdateTickets ?? false,
      canViewOrders: context.canViewOrders ?? true,
      canCreateOrders: context.canCreateOrders ?? false,
      canUpdateOrders: context.canUpdateOrders ?? false,
      canViewCustomers: context.canViewCustomers ?? true,
      canCreateCustomers: context.canCreateCustomers ?? false,
      canUpdateCustomers: context.canUpdateCustomers ?? false,
      canViewCarts: context.canViewCarts ?? true,
      canCreateCarts: context.canCreateCarts ?? false,
      canUpdateCarts: context.canUpdateCarts ?? false,
      canViewProducts: context.canViewProducts ?? true,

      vipThreshold: context.vipThreshold
    };

    const userEmail = sessionCtx.userEmail;
    const projectKey = sessionCtx.projectKey;

    // Rate-limit by userEmail so runaway clients can't spam the LLM
    if (isRateLimited(userEmail)) {
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
        sessionCtx.pageContext as { type: string; id: string } | null | undefined
      );
      sessionId = session.sessionId; // use what the store returned (same UUID)
    } catch (err) {
      console.error("[chat] Session load/create failed (non-fatal):", err);
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
          stepCountIs(20),
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
        temperature: 0.3,
        onError: (event) => {
          console.error("[chat] streamText error:", event.error);
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
            console.warn("[chat] Working memory persist failed (non-fatal):", err);
          }

          // ── Session persistence — append messages to MongoDB ───────────
          if (!session) return;

          try {
            const newMessages: StoredMessage[] = [];

            // User turn — the last message in the incoming array
            const uiMessages = messages as UIMessage[];
            const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user");
            if (lastUserMsg) {
              newMessages.push({
                id: lastUserMsg.id ?? crypto.randomUUID(),
                role: "user",
                content: extractText(lastUserMsg),
                createdAt: new Date().toISOString(),
              });
            }

            // Assistant turn — concatenate text from all steps
            const assistantText = steps
              .map((s) => s.text ?? "")
              .filter(Boolean)
              .join(" ")
              .trim();

            if (assistantText) {
              newMessages.push({
                id: crypto.randomUUID(),
                role: "assistant",
                content: assistantText,
                createdAt: new Date().toISOString(),
              });
            }

            if (newMessages.length > 0) {
              await appendSessionMessages(session!.sessionId, newMessages);
            }
          } catch (err) {
            console.error("[chat] onFinish persistence failed (non-fatal):", err);
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
    const userEmail = (request.query.userEmail as string | undefined)?.trim() ?? "";

    if (!sessionId || !userEmail) {
      response.status(400).json({ error: "sessionId and userEmail are required" });
      return;
    }

    const messages = await getSessionMessages(sessionId, userEmail);
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
    const userEmail = (request.query.userEmail as string | undefined)?.trim() ?? "";
    const projectKey = (request.query.projectKey as string | undefined)?.trim() ?? "";
    const limit = Math.min(Number(request.query.limit ?? 20), 100);
    const skip = Math.max(Number(request.query.skip ?? 0), 0);

    if (!userEmail) {
      response.status(400).json({ error: "userEmail is required" });
      return;
    }

    const result = await listSessions(userEmail, projectKey, limit, skip);
    response.json(result);
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
    const sessionId   = (request.query.sessionId   as string | undefined)?.trim() ?? "";
    const customerId  = (request.query.customerId  as string | undefined)?.trim() ?? "";
    const userEmail   = (request.query.userEmail   as string | undefined)?.trim() ?? "";
    const projectKey  = (request.query.projectKey  as string | undefined)?.trim() ?? "";
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
