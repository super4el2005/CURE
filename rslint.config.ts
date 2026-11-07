import { defineConfig, js, ts } from "@rslint/core";

export default defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "dist/**",
      ".tanstack/**",
      ".husky/**",
      "src/routeTree.gen.ts",
      "convex/_generated/**",
      "locales/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
]);
