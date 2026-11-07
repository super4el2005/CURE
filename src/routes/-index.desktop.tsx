import { useLingui } from "@lingui/react/macro";

import { AiSettings } from "@/src/components/ai-settings";
import { AuthPanel } from "@/src/components/auth-panel";
import { LanguageSwitcher } from "@/src/components/language-switcher";
import { LocalCounter } from "@/src/components/local-counter";
import { MedicalCatalog } from "@/src/components/medical-catalog";

export function DesktopHome() {
  const { t } = useLingui();
  return (
    <main data-page="desktop" style={{ maxWidth: 1120, margin: "0 auto", padding: 32 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p>{t`Версия для компьютера`}</p>
          <h1>{t`Привет, мир!`}</h1>
        </div>
        <LanguageSwitcher />
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 32 }}>
        <aside>
          <AuthPanel />
        </aside>
        <section>
          <LocalCounter />
          <AiSettings />
          <MedicalCatalog />
        </section>
      </div>
    </main>
  );
}
