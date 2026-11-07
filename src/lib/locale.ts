import Negotiator from "negotiator";

export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";
export const localeCookie = "cure.locale";
export const lastLocaleKey = "cure.last-locale";

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}

export function negotiateLocale(acceptLanguage: string | undefined): Locale {
  const match = new Negotiator({
    headers: { "accept-language": acceptLanguage ?? "" },
  }).language(locales);
  return isLocale(match) ? match : defaultLocale;
}

export function resolveRequestLocale(cookie: unknown, acceptLanguage: string | undefined): Locale {
  return isLocale(cookie) ? cookie : negotiateLocale(acceptLanguage);
}

export function resolveClientLocale({
  cookie,
  serverLocale,
  savedLocale,
  languages,
}: {
  cookie?: string | undefined;
  serverLocale?: string | undefined;
  savedLocale?: string | null | undefined;
  languages: readonly string[];
}): Locale {
  if (isLocale(cookie)) return cookie;
  if (isLocale(serverLocale)) return serverLocale;
  if (isLocale(savedLocale)) return savedLocale;
  // navigator.languages is already ordered; keep that order during negotiation.
  for (const language of languages) {
    const match = new Negotiator({ headers: { "accept-language": language } }).language(locales);
    if (isLocale(match)) return match;
  }
  return defaultLocale;
}
