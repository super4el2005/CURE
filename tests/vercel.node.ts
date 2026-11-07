import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

// Exercise the deployment entry in Node, with the real built Rspack chunks.
// No HTTP server is started and no external service is contacted.
const entryUrl = pathToFileURL(resolve("api/index.ts")).href;
const { default: app } = (await import(entryUrl)) as {
  default: { fetch(request: Request): Promise<Response> };
};

const nativeFetch = globalThis.fetch;

function signInRequest() {
  return new Request("https://cure-avx3.vercel.app/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "google" }),
  });
}

test("forwards an immutable fetch response without throwing", async (t) => {
  const payload = { url: "https://accounts.google.com/", redirect: true };
  // Native fetch produces immutable response headers, unlike new Response().
  const upstream = await nativeFetch(
    `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`,
  );
  assert.throws(() => upstream.headers.set("test", "value"), TypeError);
  t.mock.method(globalThis, "fetch", async () => upstream);
  t.after(() => t.mock.restoreAll());

  const response = await app.fetch(signInRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), payload);
});

test("preserves redirect, multiple cookies and the upstream stream", async (t) => {
  const cookies = [
    "oauth-state=first; Path=/; HttpOnly; Secure; SameSite=Lax",
    "session=second; Path=/; HttpOnly; Secure; SameSite=Lax",
  ];
  const upstream = new Response("redirect body", {
    status: 302,
    statusText: "Found",
    headers: [
      ["location", "https://accounts.google.com/"],
      ...cookies.map((cookie): [string, string] => ["set-cookie", cookie]),
    ],
  });
  t.mock.method(globalThis, "fetch", async () => upstream);
  t.after(() => t.mock.restoreAll());

  const response = await app.fetch(signInRequest());
  assert.equal(response.status, 302);
  assert.equal(response.statusText, "Found");
  assert.equal(response.headers.get("location"), "https://accounts.google.com/");
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.equal(response.body, upstream.body);
  assert.equal(await response.text(), "redirect body");
});
