import { describe, expect, it } from "@rstest/core";

import { negotiateLocale, resolveClientLocale, resolveRequestLocale } from "@/src/lib/locale";

describe("request locale", () => {
  it.each([
    ["en-US,en;q=0.9,ru;q=0.8", "en"],
    ["ru-RU,ru;q=0.9,en;q=0.8", "ru"],
    ["ru;q=0.2,en;q=0.9", "en"],
    ["en;q=0,ru;q=0.5", "ru"],
    ["de-DE,fr;q=0.9,en-GB;q=0.8", "en"],
    ["de-DE,fr", "ru"],
    ["*", "ru"],
    [undefined, "ru"],
  ])("negotiates %s as %s", (header, locale) => {
    expect(negotiateLocale(header)).toBe(locale);
  });

  it("honors only supported cookie values", () => {
    expect(resolveRequestLocale("ru", "en-US")).toBe("ru");
    expect(resolveRequestLocale("en", "ru-RU")).toBe("en");
    expect(resolveRequestLocale("invalid", "en-US")).toBe("en");
  });
});

describe("client locale continuity", () => {
  it("uses serialized server locale rather than browser or previous offline preferences", () => {
    expect(
      resolveClientLocale({ serverLocale: "en", savedLocale: "ru", languages: ["ru-RU"] }),
    ).toBe("en");
  });

  it("applies manual language selection on client navigation", () => {
    expect(resolveClientLocale({ cookie: "ru", serverLocale: "en", languages: ["en-US"] })).toBe(
      "ru",
    );
  });

  it("restores the last language in the generic offline shell", () => {
    expect(resolveClientLocale({ savedLocale: "en", languages: ["ru-RU"] })).toBe("en");
  });

  it("uses browser languages only when offline without a saved or server locale", () => {
    expect(resolveClientLocale({ languages: ["de-DE", "en-US", "ru-RU"] })).toBe("en");
    expect(resolveClientLocale({ languages: [] })).toBe("ru");
  });
});
