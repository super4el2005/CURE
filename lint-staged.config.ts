import { defineConfig } from "lint-staged/config";

export default defineConfig({
  "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,css,scss,less,md,mdx,yaml,yml,html}":
    "oxfmt --no-error-on-unmatched-pattern",
});
