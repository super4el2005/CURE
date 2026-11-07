import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3102" },
  webServer: {
    command: "npm run start -- --port 3102 --host 127.0.0.1",
    url: "http://localhost:3102/manifest.webmanifest",
    reuseExistingServer: false,
  },
});
