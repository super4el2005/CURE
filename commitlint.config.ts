import type { UserConfig } from "@commitlint/types";

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "docs",
        "style",
        "test",
        "chore",
        "perf",
        "build",
        "ci",
        "revert",
      ],
    ],
    "header-max-length": [2, "always", 100],
  },
} satisfies UserConfig;
