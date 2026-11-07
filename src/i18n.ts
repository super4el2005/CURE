import { setupI18n } from "@lingui/core";

import { messages as en } from "@/locales/en/messages.po";
import { messages as ru } from "@/locales/ru/messages.po";

export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";

export function resolveLocale(value: unknown): Locale {
  return locales.find((locale) => locale === value) ?? defaultLocale;
}

const catalogs = { ru, en };

// Create an instance for each rendered app; never share mutable locale state
// between server requests. Catalogs themselves can safely be shared.
export function createI18n(locale: Locale) {
  return setupI18n({
    locale,
    messages: { [locale]: catalogs[locale] },
  });
}
