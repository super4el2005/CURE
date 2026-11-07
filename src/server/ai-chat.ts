import "@tanstack/react-start/server-only";
import { isAiProvider } from "@/src/lib/ai-providers";
import type { AiInput } from "@/src/lib/ai-providers";
import { classifyAiError } from "@/src/server/ai-error";
import { generateByok } from "@/src/server/byok";
import { generateGigaChat } from "@/src/server/gigachat";

function failure(code: string, status: number) {
  return Response.json(
    { error: code },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function handleAiChat(
  request: Request,
  authenticate: () => Promise<boolean>,
  generate = async (req: Request, input: AiInput) =>
    input.provider === "gigachat" ? generateGigaChat(input) : generateByok(req, input),
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return failure("FORBIDDEN_ORIGIN", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return failure("INVALID_CONTENT_TYPE", 415);
  try {
    if (!(await authenticate())) return failure("UNAUTHENTICATED", 401);
  } catch {
    return failure("AUTH_UNAVAILABLE", 503);
  }
  let input: AiInput;
  try {
    const text = await request.text();
    if (text.length > 64_000) return failure("REQUEST_TOO_LARGE", 413);
    const body: unknown = JSON.parse(text);
    if (typeof body !== "object" || body === null) return failure("INVALID_REQUEST", 400);
    const value = body as Record<string, unknown>;
    const provider = value.provider ?? "gigachat";
    if (
      !isAiProvider(provider) ||
      !Array.isArray(value.messages) ||
      value.messages.length === 0 ||
      value.messages.length > 32
    )
      return failure("INVALID_REQUEST", 400);
    const messages = value.messages.map((message: unknown): AiInput["messages"][number] => {
      if (
        typeof message !== "object" ||
        message === null ||
        !("role" in message) ||
        (message.role !== "user" && message.role !== "assistant") ||
        !("content" in message) ||
        typeof message.content !== "string" ||
        message.content.length > 8000
      )
        throw new Error("Invalid message");
      return { role: message.role, content: message.content };
    });
    if (
      provider !== "gigachat" &&
      (typeof value.model !== "string" || !value.model.trim() || value.model.length > 200)
    )
      return failure("INVALID_MODEL", 400);
    input = {
      provider,
      model: typeof value.model === "string" ? value.model : "",
      messages,
      ...(typeof value.baseURL === "string" ? { baseURL: value.baseURL } : {}),
    };
  } catch {
    return failure("INVALID_REQUEST", 400);
  }
  try {
    const text = await generate(request, input);
    return Response.json(
      { text, provider: input.provider },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const code = classifyAiError(error);
    console.error("AI request failed", { code, provider: input.provider });
    return failure(code, 503);
  }
}
