import { useLingui } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/error")({
  component: AuthError,
});

function AuthError() {
  const { t } = useLingui();

  return (
    <main>
      <h1>{t`Не удалось войти`}</h1>
      <p>{t`Вход был отменён или произошла ошибка. Вернитесь на главную и попробуйте ещё раз.`}</p>
      <Link to="/" search={(prev) => ({ lang: prev.lang ?? "ru" })}>
        {t`На главную`}
      </Link>
    </main>
  );
}
