import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "@/src/lib/auth-client";
import { useOnline } from "@/src/lib/network";

export function AuthPanel() {
  const { t } = useLingui();
  const online = useOnline();
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setIsSubmitting(true);
    try {
      const errorURL = new URL("/auth/error", window.location.origin);
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.href,
        errorCallbackURL: errorURL.href,
      });
      if (result.error) throw new Error("Sign-in failed");
    } catch {
      setError(t`Не удалось войти. Попробуйте ещё раз.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign-out failed");
      await queryClient.cancelQueries();
      queryClient.clear();
      await router.invalidate();
    } catch {
      setError(t`Не удалось выйти. Попробуйте ещё раз.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-label={t`Аккаунт`}>
      {!online ? (
        <p role="status">{t`Сессия будет проверена после подключения к интернету.`}</p>
      ) : isPending ? (
        <p role="status">{t`Проверяем сессию…`}</p>
      ) : session ? (
        <>
          <p>{session.user.name}</p>
          <p>{session.user.email}</p>
          <button type="button" disabled={isSubmitting} onClick={() => void signOut()}>
            {t`Выйти`}
          </button>
        </>
      ) : (
        <button type="button" disabled={isSubmitting} onClick={() => void signIn()}>
          {t`Войти через Google`}
        </button>
      )}
      {(error || sessionError) && (
        <p role="alert">{error ?? t`Не удалось проверить сессию. Попробуйте обновить страницу.`}</p>
      )}
    </section>
  );
}
