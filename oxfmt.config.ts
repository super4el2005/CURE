import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  sortImports: {
    internalPattern: ["@/"],
    groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "style", "unknown"],
    newlinesBetween: true,
    sortSideEffects: false,
  },
  ignorePatterns: [
    "src/routeTree.gen.ts",
    "convex/_generated/**",
    ".tanstack/**",
    "locales/*/messages.js",
    "package-lock.json",
  ],
});
