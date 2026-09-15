import {
  createOpenRouter,
  type LanguageModelV3,
} from "@openrouter/ai-sdk-provider";

// OpenRouter model slug used for the SAM in-app chat agent. Override with
// OPENROUTER_MODEL to swap models without a code change.
const DEFAULT_CHAT_AGENT_MODEL = "openai/gpt-5.6-luna";

// Previous default; kept reachable via OPENROUTER_MODEL for rollback. Its
// routing needs the ZDR/provider tuning below.
const MINIMAX_M3 = "minimax/minimax-m3";

/**
 * Ollama exposes an OpenAI-compatible chat-completions endpoint. Reusing the
 * OpenRouter AI SDK adapter here keeps the LanguageModelV3 contract required
 * by Think while sending requests directly to the operator's Ollama service.
 */
export function buildOllamaChatAgentModel(
  baseURL: string,
  modelId: string,
): LanguageModelV3 {
  const ollama = createOpenRouter({
    apiKey: "ollama",
    baseURL: baseURL.replace(/\/$/, ""),
  });
  return ollama(modelId);
}

export function buildConfiguredChatAgentModel(
  env: Cloudflare.Env,
  reasoningEffort: "max" | "low",
): LanguageModelV3 {
  const provider = env.AI_PROVIDER?.trim() || "openrouter";
  if (provider === "ollama") {
    const baseURL = env.OLLAMA_BASE_URL?.trim();
    const model = env.OLLAMA_MODEL?.trim();
    if (!baseURL || !model) {
      throw new Error(
        "OLLAMA_BASE_URL and OLLAMA_MODEL are required when AI_PROVIDER=ollama",
      );
    }
    return buildOllamaChatAgentModel(baseURL, model);
  }
  if (provider !== "openrouter") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for the SAM agent");
  }
  return buildChatAgentModel(
    apiKey,
    env.OPENROUTER_MODEL?.trim(),
    reasoningEffort,
  );
}

/**
 * Returns the AI SDK LanguageModel for the chat agent. `usage: { include: true }`
 * turns on OpenRouter usage accounting so each response carries its real USD
 * cost (providerMetadata.openrouter.usage.cost) — which we meter against the
 * shared usage-credit pool.
 *
 * Default model: GPT-5.6 Luna at `reasoning.effort: "max"` — "max" is valid at
 * the OpenRouter API for GPT-5.x but missing from the SDK's effort union, so
 * the reasoning config rides in `extraBody`. Reasoning tokens stream on the
 * separate reasoning channel and are billed as output tokens, which the usage
 * accounting above captures.
 *
 * Sync on purpose: Think's `getModel()` hook is sync and runs on every turn,
 * so the SAM agent reads the key/model from its DO env and builds here.
 */
function buildChatAgentModel(
  apiKey: string,
  modelId?: string,
  reasoningEffort: "max" | "low" = "max",
): LanguageModelV3 {
  const model = modelId ?? DEFAULT_CHAT_AGENT_MODEL;
  const openrouter = createOpenRouter({ apiKey });

  // MiniMax M3 (env-override path only): `provider.order` prefers Together,
  // then Atlas Cloud (fp8); `zdr: true` restricts routing to Zero-Data-
  // Retention endpoints, which excludes MiniMax first-party — the account's
  // "Non-frontier requires ZDR" data policy enforces the same, this flag is
  // belt-and-braces. Fallbacks stay on within the ZDR set because pinning
  // providers caused a prod outage (Jul 2026: Together upstream-rate-limited
  // m3 and every chat turn 429'd). The explicit reasoning channel keeps m3's
  // `<think>` trace out of the visible answer text.
  if (model === MINIMAX_M3) {
    return openrouter(model, {
      usage: { include: true },
      reasoning: { effort: reasoningEffort === "low" ? "low" : "medium" },
      provider: {
        order: ["together", "atlas-cloud/fp8"],
        zdr: true,
        allow_fallbacks: true,
      },
    });
  }

  return openrouter(model, {
    usage: { include: true },
    extraBody: { reasoning: { effort: reasoningEffort } },
  });
}
