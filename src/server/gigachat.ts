import "@tanstack/react-start/server-only";
import GigaChat from "gigachat";

import type { AiInput } from "@/src/lib/ai-providers";
import { AiConfigurationError } from "@/src/server/ai-error";
import { createGigaChatHttpsAgent } from "@/src/server/gigachat-ca";

let client: GigaChat | undefined;

export function getGigaChatClient() {
  if (client) return client;
  const credentials = process.env.GIGACHAT_CREDENTIALS;
  const scope = process.env.GIGACHAT_SCOPE ?? "GIGACHAT_API_PERS";
  if (
    !credentials ||
    !["GIGACHAT_API_PERS", "GIGACHAT_API_B2B", "GIGACHAT_API_CORP"].includes(scope)
  ) {
    throw new AiConfigurationError("GigaChat is not configured");
  }
  // OAuth, access-token expiry and authentication retries belong to the SDK.
  client = new GigaChat({
    credentials,
    scope,
    model: process.env.GIGACHAT_MODEL ?? "GigaChat",
    baseUrl: "https://api.giga.chat/v1",
    timeout: 60,
    verbose: false,
    httpsAgent: createGigaChatHttpsAgent(process.env.GIGACHAT_CA_CERT),
  });
  return client;
}

export async function generateGigaChat(
  input: AiInput,
  getClient: () => Pick<GigaChat, "chat"> = getGigaChatClient,
) {
  const result = await getClient().chat({ messages: input.messages, max_tokens: 1024 });
  const text = result.choices[0]?.message.content;
  if (typeof text !== "string") throw new Error("Empty GigaChat response");
  return text;
}
