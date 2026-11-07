import { useLingui } from "@lingui/react/macro";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AuthPanel } from "@/src/components/auth-panel";
import { LocalCounter } from "@/src/components/local-counter";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { t } = useLingui();

  return (
    <main>
      <nav aria-label={t`Язык интерфейса`}>
        <Link to="/" search={(prev) => ({ ...prev, lang: "ru" })} lang="ru">
          Русский
        </Link>
        {" / "}
        <Link to="/" search={(prev) => ({ ...prev, lang: "en" })} lang="en">
          English
        </Link>
      </nav>
      <h1>{t`Привет, мир!`}</h1>
      <AuthPanel />
      <LocalCounter />
    </main>
  );
}
