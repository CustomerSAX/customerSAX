import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { LanguageModel } from "ai";

export type LlmProvider = "openai" | "anthropic";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export function getConfiguredProvider(): LlmProvider {
  const p = process.env.DEFAULT_LLM_PROVIDER?.toLowerCase();
  if (p === "anthropic" || p === "claude") return "anthropic";
  return "openai";
}

export function getLanguageModel(provider?: string): LanguageModel {
  const resolved: LlmProvider =
    provider === "anthropic" || provider === "claude" ? "anthropic" : "openai";

  if (resolved === "openai") {
    const model = (process.env.OPENAI_MODEL ?? "gpt-4o").replace(/^openai\//, "");
    return openai(model);
  }

  // Anthropic path — dynamic import so it doesn't crash when not installed
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAnthropic } = require("@ai-sdk/anthropic");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const anthropicClient = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6").replace(/^anthropic\//, "");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return anthropicClient(model) as LanguageModel;
  } catch {
    console.warn("[llm] @ai-sdk/anthropic not available, falling back to OpenAI");
    const model = (process.env.OPENAI_MODEL ?? "gpt-4o").replace(/^openai\//, "");
    return openai(model);
  }
}

export function listProviders() {
  return [
    {
      provider: "openai",
      defaultModel: process.env.OPENAI_MODEL ?? "gpt-4o",
      configured: Boolean(process.env.OPENAI_API_KEY)
    },
    {
      provider: "anthropic",
      defaultModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      configured: Boolean(process.env.ANTHROPIC_API_KEY)
    }
  ];
}

// Legacy helper used by /assist route
export async function completeWithLlm({ message, provider }: { message: string; provider?: string }) {
  const model = getLanguageModel(provider);
  const result = await generateText({
    model,
    prompt: message,
    temperature: 0
  });
  return {
    model: String(model),
    provider: getConfiguredProvider(),
    response: result.text
  };
}
