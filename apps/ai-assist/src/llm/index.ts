import type { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatXAI } from "@langchain/xai";

export type LlmProvider = "anthropic" | "grok" | "openai";

type CompleteRequest = {
  message: string;
  provider?: string;
};

type CompleteResult = {
  model: string;
  provider: LlmProvider;
  response: string;
};

type ProviderConfig = {
  apiKey?: string;
  defaultModel: string;
};

const providers: Record<LlmProvider, ProviderConfig> = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
  },
  grok: {
    apiKey: process.env.XAI_API_KEY,
    defaultModel: process.env.XAI_MODEL ?? "grok-4.5"
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_MODEL ?? "gpt-5.6-luna"
  }
};

export function getConfiguredProvider(): LlmProvider {
  return normalizeProvider(process.env.DEFAULT_LLM_PROVIDER) ?? "openai";
}

export function listProviders() {
  return Object.entries(providers).map(([provider, config]) => ({
    configured: Boolean(config.apiKey),
    defaultModel: config.defaultModel,
    provider
  }));
}

export async function completeWithLlm(request: CompleteRequest): Promise<CompleteResult> {
  const provider = normalizeProvider(request.provider) ?? getConfiguredProvider();
  const config = providers[provider];

  if (!config.apiKey) {
    return {
      model: config.defaultModel,
      provider,
      response: `Hello from CSA AI Assist using ${provider}. Add the ${apiKeyName(provider)} secret to call the live model.`
    };
  }

  if (provider === "anthropic") {
    return completeWithAnthropic(request.message, config);
  }

  if (provider === "grok") {
    return completeWithGrok(request.message, config);
  }

  return completeWithOpenAi(request.message, config);
}

function normalizeProvider(provider?: string): LlmProvider | undefined {
  if (provider === "anthropic" || provider === "claude") {
    return "anthropic";
  }

  if (provider === "grok" || provider === "xai") {
    return "grok";
  }

  if (provider === "openai") {
    return "openai";
  }

  if (provider) {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  return undefined;
}

function apiKeyName(provider: LlmProvider) {
  const names: Record<LlmProvider, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    grok: "XAI_API_KEY",
    openai: "OPENAI_API_KEY"
  };

  return names[provider];
}

async function completeWithOpenAi(
  message: string,
  config: ProviderConfig
): Promise<CompleteResult> {
  const model = new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.defaultModel,
    temperature: 0
  });
  const result = await model.invoke(message);

  return {
    model: config.defaultModel,
    provider: "openai",
    response: messageContentToText(result)
  };
}

async function completeWithAnthropic(
  message: string,
  config: ProviderConfig
): Promise<CompleteResult> {
  const model = new ChatAnthropic({
    apiKey: config.apiKey,
    maxTokens: 512,
    model: config.defaultModel,
    temperature: 0
  });
  const result = await model.invoke(message);

  return {
    model: config.defaultModel,
    provider: "anthropic",
    response: messageContentToText(result)
  };
}

async function completeWithGrok(
  message: string,
  config: ProviderConfig
): Promise<CompleteResult> {
  const model = new ChatXAI({
    apiKey: config.apiKey,
    model: config.defaultModel,
    temperature: 0
  });
  const result = await model.invoke(message);

  return {
    model: config.defaultModel,
    provider: "grok",
    response: messageContentToText(result)
  };
}

function messageContentToText(message: BaseMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  return message.content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if ("text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("");
}
