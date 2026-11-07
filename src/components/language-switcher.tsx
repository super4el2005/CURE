import { useLingui } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";

import { lastLocaleKey, localeCookie } from "@/src/lib/locale";
import type { Locale } from "@/src/lib/locale";

export function LanguageSwitcher() {
  const { t, i18n } = useLingui();
  const router = useRouter();

  async function changeLocale(locale: Locale) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${localeCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    try {
      localStorage.setItem(lastLocaleKey, locale);
    } catch {
      // Cookies and the current UI can work without localStorage.
    }
    await router.invalidate();
  }

  return (
    <nav aria-label={t`Язык интерфейса`}>
      <button
        type="button"
        onClick={() => void changeLocale("ru")}
        lang="ru"
        aria-pressed={i18n.locale === "ru"}
      >
        Русский
      </button>
      {" / "}
      <button
        type="button"
        onClick={() => void changeLocale("en")}
        lang="en"
        aria-pressed={i18n.locale === "en"}
      >
        English
      </button>
    </nav>
  );
}
