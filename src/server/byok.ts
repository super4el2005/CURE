import "@tanstack/react-start/server-only";
import { chat } from "@tanstack/ai";
import type { AnyTextAdapter } from "@tanstack/ai";
import { ANTHROPIC_MODELS, createAnthropicChat } from "@tanstack/ai-anthropic";
import { GEMINI_MODELS, createGeminiChat } from "@tanstack/ai-gemini";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { getByokKey } from "@tanstack/ai/byok/server";

import type { AiInput } from "@/src/lib/ai-providers";
import { AiConfigurationError } from "@/src/server/ai-error";

const endpoints = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
};

export function resolveCustomEndpoint(
  value: string | undefined,
  allowed = process.env.AI_ALLOWED_BASE_URLS ?? "",
) {
  const normalized = (value ?? "").replace(/\/+$/, "");
  const url = new URL(normalized);
  const allowlist = allowed.split(",").map((item) => item.trim().replace(/\/+$/, ""));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !allowlist.includes(normalized)
  ) {
    throw new AiConfigurationError("Custom AI endpoint is not allowed");
  }
  return normalized;
}

export function createByokAdapter(
  request: Request,
  input: AiInput,
  fetchImpl: typeof fetch = fetch,
): AnyTextAdapter {
  if (input.provider === "gigachat") throw new AiConfigurationError("GigaChat uses its own SDK");
  // A slug reads the user's header only, with no fallback to application env keys.
  const apiKey = getByokKey(request, input.provider);
  if (!apiKey || apiKey.length > 4096) throw new AiConfigurationError("User API key is missing");
  if (input.provider === "anthropic") {
    const model = ANTHROPIC_MODELS.find((item) => item === input.model);
    if (!model) throw new AiConfigurationError("Unsupported Anthropic model");
    return createAnthropicChat(model, apiKey, { maxRetries: 0 });
  }
  if (input.provider === "gemini") {
    const model = GEMINI_MODELS.find((item) => item === input.model);
    if (!model) throw new AiConfigurationError("Unsupported Gemini model");
    return createGeminiChat(model, apiKey);
  }
  const baseURL =
    input.provider === "custom" ? resolveCustomEndpoint(input.baseURL) : endpoints[input.provider];
  return openaiCompatibleText(input.model, {
    name: input.provider,
    baseURL,
    apiKey,
    maxRetries: 0,
    timeout: 60_000,
    fetch: (url, init) => fetchImpl(url, { ...init, redirect: "error" }),
  });
}

export async function generateByok(request: Request, input: AiInput) {
  // Never cache a user adapter or key in a module-level singleton.
  const adapter = createByokAdapter(request, input);
  const result = await chat({
    adapter,
    messages: input.messages,
    threadId: crypto.randomUUID(),
    stream: false,
    modelOptions: input.provider === "gemini" ? { maxOutputTokens: 1024 } : { max_tokens: 1024 },
  });
  return result.text;
}
