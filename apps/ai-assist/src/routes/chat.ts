import { Router } from "express";
import { Readable } from "stream";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { getLanguageModel } from "../llm/index.js";
import { buildSystemPrompt, contextStorage } from "../chat/system-prompt.js";
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

      // ACL — reads default true, writes default true
      canViewTickets: context.canViewTickets ?? true,
      canCreateTickets: context.canCreateTickets ?? true,
      canUpdateTickets: context.canUpdateTickets ?? true,
      canViewOrders: context.canViewOrders ?? true,
      canCreateOrders: context.canCreateOrders ?? true,
      canUpdateOrders: context.canUpdateOrders ?? true,
      canViewCustomers: context.canViewCustomers ?? true,
      canCreateCustomers: context.canCreateCustomers ?? true,
      canUpdateCustomers: context.canUpdateCustomers ?? true,
      canViewCarts: context.canViewCarts ?? true,
      canCreateCarts: context.canCreateCarts ?? true,
      canUpdateCarts: context.canUpdateCarts ?? true,
      canViewProducts: context.canViewProducts ?? true,

      vipThreshold: context.vipThreshold
    };

    const systemPrompt = buildSystemPrompt(sessionCtx);
    const model = getLanguageModel(provider);
    const chatTools = buildChatTools();

    // Convert UIMessage[] (from @ai-sdk/react client) → ModelMessage[] (for ai@7 streamText)
    const modelMessages = await convertToModelMessages(messages as UIMessage[]);

    const result = await contextStorage.run(sessionCtx, () => {
      return streamText({
        model,
        system: systemPrompt,
        messages: modelMessages,
        tools: chatTools,
        stopWhen: stepCountIs(20),
        temperature: 0.3,
        onError: (event) => {
          console.error("[chat] streamText error:", event.error);
        }
      });
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
