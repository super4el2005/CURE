import { useLingui } from "@lingui/react/macro";

import { AiSettings } from "@/src/components/ai-settings";
import { AuthPanel } from "@/src/components/auth-panel";
import { LanguageSwitcher } from "@/src/components/language-switcher";
import { LocalCounter } from "@/src/components/local-counter";

export function MobileHome() {
  const { t } = useLingui();
  return (
    <main data-page="mobile" style={{ padding: 16 }}>
      <header>
        <p>{t`Мобильная версия`}</p>
        <h1>{t`Привет, мир!`}</h1>
        <LanguageSwitcher />
      </header>
      <section style={{ marginTop: 24 }}>
        <LocalCounter />
        <AiSettings />
      </section>
      <section style={{ marginTop: 24 }}>
        <AuthPanel />
      </section>
    </main>
  );
}
