import { setupI18n } from "@lingui/core";

import { messages as en } from "@/locales/en/messages.po";
import { messages as ru } from "@/locales/ru/messages.po";
import type { Locale } from "@/src/lib/locale";

const catalogs = { ru, en };

// Create an instance for each rendered app; never share mutable locale state
// between server requests. Catalogs themselves can safely be shared.
export function createI18n(locale: Locale) {
  return setupI18n({
    locale,
    messages: { [locale]: catalogs[locale] },
  });
}
