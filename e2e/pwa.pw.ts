import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, expect, test } from "@playwright/test";

test("manifest and anonymous shell are served; online pages retain SSR", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  const response = await request.get("/?lang=en");
  expect(response.ok()).toBeTruthy();
  expect(await response.text()).toContain("Hello, world!");
  const shell = await request.get("/_shell.html");
  expect(shell.ok()).toBeTruthy();
  const html = await shell.text();
  expect(html).not.toContain("session_token");
  expect(html).not.toContain("GOOGLE_CLIENT_SECRET");
});

test("installed worker boots offline after a browser restart and retains local TanStack DB data", async () => {
  const profile = await mkdtemp(join(tmpdir(), "cure-pwa-"));
  let context = await chromium.launchPersistentContext(profile, { headless: true });
  try {
    await context.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
    let page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:3102/?lang=en");
    await expect(page.getByRole("heading", { name: "Hello, world!" })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
            once: true,
          }),
        );
      }
    });
    await expect(page.getByText("The app is ready to open offline.")).toBeVisible();
    expect(errors, "initial online hydration").toEqual([]);
    await page.getByRole("button", { name: "Add 1 to 0?" }).click();
    await expect(page.getByRole("button", { name: "Add 1 to 1?" })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("button", { name: "Add 1 to 1?" })).toBeVisible();
    expect(errors, "offline reload hydration").toEqual([]);
    await page.getByRole("button", { name: "Add 1 to 1?" }).click();
    await expect(page.getByRole("button", { name: "Add 1 to 2?" })).toBeVisible();
    await context.close();

    context = await chromium.launchPersistentContext(profile, { headless: true, offline: true });
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:3102/?lang=en");
    await expect(page.getByRole("heading", { name: "Hello, world!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add 1 to 2?" })).toBeVisible();
    await expect(page.getByText("Your session will be checked when you reconnect.")).toBeVisible();
    expect(errors, "offline restart hydration").toEqual([]);
    await page.goto("http://localhost:3102/auth/error?lang=en");
    await expect(page.getByRole("heading", { name: "Unable to sign in" })).toBeVisible();
    const cachedURLs = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const key of await caches.keys()) {
        for (const request of await (await caches.open(key)).keys()) urls.push(request.url);
      }
      return urls;
    });
    expect(cachedURLs.some((url) => url.includes("/api/auth/"))).toBe(false);
    expect(cachedURLs.some((url) => url.includes("/_serverFn/"))).toBe(false);
    expect(errors).toEqual([]);
    await context.setOffline(false);
    await page.goto("http://localhost:3102/?lang=ru");
    await expect(page.getByRole("heading", { name: "Привет, мир!" })).toBeVisible();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
