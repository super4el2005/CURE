import type { GenericCtx } from "@convex-dev/better-auth";
import { afterAll, beforeAll, describe, expect, it, rstest } from "@rstest/core";

import type { DataModel } from "@/convex/_generated/dataModel";

let createAuth: typeof import("@/convex/auth").createAuth;

beforeAll(async () => {
  // Better Auth disables origin checks by default in its test environment.
  // Exercise the real development defaults instead.
  rstest.stubEnv("NODE_ENV", "development");
  rstest.stubEnv("TEST", undefined);
  rstest.stubEnv("SITE_URL", "http://localhost:3000");
  rstest.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  rstest.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-with-at-least-32-characters");
  rstest.stubEnv("GOOGLE_CLIENT_ID", "test.apps.googleusercontent.com");
  rstest.stubEnv("GOOGLE_CLIENT_SECRET", "test-only-google-secret");
  ({ createAuth } = await import("@/convex/auth"));
});

afterAll(() => {
  rstest.unstubAllEnvs();
});

// These requests must complete before accessing the database. A minimal context
// makes accidental database access fail instead of talking to a real deployment.
function authHandler() {
  return createAuth({} as GenericCtx<DataModel>).handler;
}

function signInRequest(origin: string, callbackURL: string) {
  return new Request("http://localhost:3000/api/auth/sign-in/social", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: "better-auth.session_token=test-session",
    },
    body: JSON.stringify({ provider: "google", callbackURL }),
  });
}

describe("Google auth request boundaries", () => {
  it("returns no session for an anonymous request", async () => {
    const response = await authHandler()(new Request("http://localhost:3000/api/auth/get-session"));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("rejects a cookie-bearing sign-in request from an untrusted origin", async () => {
    const response = await authHandler()(
      signInRequest("https://attacker.example", "http://localhost:3000/"),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
  });

  it("rejects an external callback even when the request origin is trusted", async () => {
    const response = await authHandler()(
      signInRequest("http://localhost:3000", "https://attacker.example"),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "INVALID_CALLBACK_URL" });
  });
});
