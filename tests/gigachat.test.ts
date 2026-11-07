import { describe, expect, it } from "@rstest/core";
import { chat } from "@tanstack/ai";
import { defineByok, memoryStorage } from "@tanstack/ai-react/byok";
import type GigaChat from "gigachat";

import { byokProviders } from "@/src/lib/ai-providers";
import type { AiInput } from "@/src/lib/ai-providers";
import { handleAiChat } from "@/src/server/ai-chat";
import { AiConfigurationError } from "@/src/server/ai-error";
import { createByokAdapter, resolveCustomEndpoint } from "@/src/server/byok";
import { generateGigaChat } from "@/src/server/gigachat";

const messages: AiInput["messages"] = [{ role: "user", content: "Hello" }];
function request(body: unknown = { messages }, headers: Record<string, string> = {}) {
  return new Request("https://cure.example/api/ai/chat", {
    method: "POST",
    headers: { origin: "https://cure.example", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

it("uses the official GigaChat SDK directly with server-controlled generation options", async () => {
  let received: unknown;
  const sdk: Pick<GigaChat, "chat"> = {
    chat: async (input) => {
      received = input;
      return {
        choices: [{ index: 0, message: { role: "assistant", content: "SDK answer" } }],
        created: 1,
        model: "GigaChat",
        object: "chat.completion",
        xHeaders: {},
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
          precached_prompt_tokens: 0,
        },
      };
    },
  };
  const text = await generateGigaChat(
    { provider: "gigachat", model: "ignored-client-model", messages },
    () => sdk,
  );
  expect(text).toBe("SDK answer");
  expect(received).toEqual({ messages, max_tokens: 1024 });
});

describe("TanStack AI BYOK", () => {
  it("isolates in-memory user keys and emits only the selected provider header", async () => {
    const userA = defineByok({ storage: memoryStorage(), providers: byokProviders });
    const userB = defineByok({ storage: memoryStorage(), providers: byokProviders });
    await userA.update("openai", "private-user-a-key");
    await userA.update("deepseek", "other-provider-key");
    expect(userB.headers("openai")).toEqual({});
    expect(userA.headers("openai")).toEqual({ "x-byok-openai": "private-user-a-key" });
    expect(JSON.stringify(userA.getSnapshot())).not.toContain("private-user-a-key");
    await userA.clear();
    expect(userA.headers()).toEqual({});
  });

  it("requires the user's key without silently using application environment keys", () => {
    expect(() =>
      createByokAdapter(request(), { provider: "openai", model: "gpt-4.1-mini", messages }),
    ).toThrow();
  });

  it("constructs native Anthropic and Gemini adapters", () => {
    for (const [provider, model] of [
      ["anthropic", "claude-sonnet-4-5"],
      ["gemini", "gemini-2.5-flash"],
    ] as const) {
      expect(
        createByokAdapter(request({}, { [`x-byok-${provider}`]: "user-key" }), {
          provider,
          model,
          messages,
        }).kind,
      ).toBe("text");
    }
  });

  it("uses each user's key through the OpenAI-compatible TanStack adapter", async () => {
    const authorization: (string | null)[] = [];
    const transport: typeof fetch = async (_url, init) => {
      authorization.push(new Headers(init?.headers).get("authorization"));
      const body = JSON.parse(String(init?.body));
      if (body.stream) {
        const chunk = (content: string, finish: string | null) =>
          JSON.stringify({
            id: "c1",
            created: 1,
            model: "example-model",
            choices: [{ index: 0, delta: { content }, finish_reason: finish }],
          });
        return new Response(
          `data: ${chunk("OK", null)}\n\ndata: ${chunk("", "stop")}\n\ndata: [DONE]\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      return Response.json({
        id: "c1",
        created: 1,
        model: "example-model",
        choices: [
          { index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" },
        ],
      });
    };
    for (const key of ["key-user-a", "key-user-b"]) {
      const adapter = createByokAdapter(
        request({}, { "x-byok-openai": key }),
        { provider: "openai", model: "example-model", messages },
        transport,
      );
      const result = await chat({ adapter, messages, threadId: "test", stream: false });
      expect(result.text).toBe("OK");
    }
    expect(authorization).toEqual(["Bearer key-user-a", "Bearer key-user-b"]);
  });

  it("only permits server-approved HTTPS custom endpoints", () => {
    expect(resolveCustomEndpoint("https://gateway.example/v1/", "https://gateway.example/v1")).toBe(
      "https://gateway.example/v1",
    );
    for (const url of [
      "http://localhost/v1",
      "https://unapproved.example/v1",
      "https://user:pass@gateway.example/v1",
      "https://gateway.example/v1?key=secret",
    ]) {
      expect(() => resolveCustomEndpoint(url, "https://gateway.example/v1")).toThrow();
    }
  });
});

describe("AI HTTP boundary", () => {
  it("defaults to GigaChat and does not put credentials into response metadata", async () => {
    let selected: string | undefined;
    const response = await handleAiChat(
      request(),
      async () => true,
      async (_req, input) => {
        selected = input.provider;
        return "Default response";
      },
    );
    expect(selected).toBe("gigachat");
    expect(await response.json()).toEqual({ text: "Default response", provider: "gigachat" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("passes an explicit provider and model to BYOK generation", async () => {
    let selected: unknown;
    const response = await handleAiChat(
      request(
        { provider: "deepseek", model: "deepseek-chat", messages },
        { "x-byok-deepseek": "user-key" },
      ),
      async () => true,
      async (_req, input) => {
        selected = input;
        return "Custom response";
      },
    );
    expect(response.status).toBe(200);
    expect(selected).toMatchObject({ provider: "deepseek", model: "deepseek-chat" });
  });

  it("blocks foreign origins before auth, and unauthenticated requests before generation", async () => {
    let authCalls = 0;
    const auth = async () => {
      authCalls++;
      return false;
    };
    expect(
      (await handleAiChat(request({}, { origin: "https://other.example" }), auth)).status,
    ).toBe(403);
    expect(authCalls).toBe(0);
    expect((await handleAiChat(request(), auth)).status).toBe(401);
  });

  it("rejects invalid providers and models", async () => {
    for (const body of [
      { provider: "unknown", messages },
      { provider: "openai", model: "", messages },
      { messages: [] },
    ]) {
      expect((await handleAiChat(request(body), async () => true)).status).toBe(400);
    }
  });

  it("never returns provider exception details or keys", async () => {
    const response = await handleAiChat(
      request(),
      async () => true,
      async () => {
        throw new Error("private-api-key");
      },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AI_UNAVAILABLE" });
    const missing = await handleAiChat(
      request(),
      async () => true,
      async () => {
        throw new AiConfigurationError("secret-info");
      },
    );
    expect(await missing.json()).toEqual({ error: "AI_NOT_CONFIGURED" });
  });
});
