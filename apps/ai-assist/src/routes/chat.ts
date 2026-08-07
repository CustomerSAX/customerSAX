import { Router } from "express";
import { Readable } from "stream";
import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { getLanguageModel } from "../llm/index.js";
import { buildSystemPrompt } from "../chat/system-prompt.js";
import { buildChatTools } from "../chat/tools/index.js";
import type { SystemPromptContext } from "../chat/system-prompt.js";

export const chatRouter = Router();

/**
 * POST /chat
 *
 * Body:
 *   messages : UIMessage[] — from the Vercel AI SDK useChat hook
 *   context  : SystemPromptContext partial — session/page/ACL context from the webapp
 *   provider : "openai" | "anthropic" — optional override
 *
 * Response: text/event-stream (UI message stream consumed by useChat)
 */
chatRouter.post("/chat", async (request, response, next) => {
  try {
    const { messages = [], context = {}, provider } = request.body as {
      messages?: unknown[];
      context?: Partial<SystemPromptContext>;
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

      // ACL — reads default true, writes default false
      canViewTickets: context.canViewTickets ?? true,
      canCreateTickets: context.canCreateTickets ?? true,
      canUpdateTickets: context.canUpdateTickets ?? false,
      canViewOrders: context.canViewOrders ?? true,
      canCreateOrders: context.canCreateOrders ?? false,
      canUpdateOrders: context.canUpdateOrders ?? false,
      canViewCustomers: context.canViewCustomers ?? true,
      canCreateCustomers: context.canCreateCustomers ?? false,
      canUpdateCustomers: context.canUpdateCustomers ?? false,
      canViewCarts: context.canViewCarts ?? true,
      canCreateCarts: context.canCreateCarts ?? true,
      canUpdateCarts: context.canUpdateCarts ?? false,
      canViewProducts: context.canViewProducts ?? true,

      vipThreshold: context.vipThreshold
    };

    const systemPrompt = buildSystemPrompt(sessionCtx);
    const model = getLanguageModel(provider);
    const chatTools = buildChatTools();

    const result = streamText({
      model,
      system: systemPrompt,
      messages: messages as ModelMessage[],
      tools: chatTools,
      stopWhen: stepCountIs(8),
      temperature: 0.3,
      onError: (event) => {
        console.error("[chat] streamText error:", event.error);
      }
    });

    // Bridge Fetch API Response → Express response
    const webResponse = result.toUIMessageStreamResponse();

    response.status(webResponse.status);
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
