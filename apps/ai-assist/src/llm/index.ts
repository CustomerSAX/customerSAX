import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

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
  defaultModel: string;
  gatewayPrefix: string;
};

const providers: Record<LlmProvider, ProviderConfig> = {
  anthropic: {
    defaultModel: process.env.ANTHROPIC_MODEL ?? "anthropic/claude-sonnet-4-6",
    gatewayPrefix: "anthropic"
  },
  grok: {
    defaultModel: process.env.XAI_MODEL ?? "xai/grok-4.5",
    gatewayPrefix: "xai"
  },
  openai: {
    defaultModel: process.env.OPENAI_MODEL ?? "openai/gpt-5.6-luna",
    gatewayPrefix: "openai"
  }
};

const aiGatewayBaseUrl = process.env.AI_GATEWAY_BASE_URL?.trim() || undefined;

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: aiGatewayBaseUrl
});

export function getConfiguredProvider(): LlmProvider {
  return normalizeProvider(process.env.DEFAULT_LLM_PROVIDER) ?? "openai";
}

export function listProviders() {
  return Object.entries(providers).map(([provider, config]) => ({
    configured: Boolean(process.env.AI_GATEWAY_API_KEY),
    defaultModel: toGatewayModelId(config),
    provider
  }));
}

export async function completeWithLlm(request: CompleteRequest): Promise<CompleteResult> {
  const provider = normalizeProvider(request.provider) ?? getConfiguredProvider();
  const config = providers[provider];
  const modelId = toGatewayModelId(config);

  if (!process.env.AI_GATEWAY_API_KEY) {
    return {
      model: modelId,
      provider,
      response: `Hello from CSA AI Assist using ${provider}. Add the AI_GATEWAY_API_KEY secret to call ${modelId} through Vercel AI Gateway.`
    };
  }

  const result = await generateText({
    model: gateway(modelId),
    prompt: request.message,
    temperature: 0
  });

  return {
    model: modelId,
    provider,
    response: result.text
  };
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

function toGatewayModelId(config: ProviderConfig) {
  const model = config.defaultModel.trim();

  if (model.includes("/")) {
    return model;
  }

  return `${config.gatewayPrefix}/${model}`;
}
