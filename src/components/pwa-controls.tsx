import { useLingui } from "@lingui/react/macro";
import { Serwist } from "@serwist/window";
import { useEffect, useState } from "react";

import { useOnline } from "@/src/lib/network";

interface InstallPrompt extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaControls() {
  const { t } = useLingui();
  const online = useOnline();
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [update, setUpdate] = useState<Serwist | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function onInstall(event: Event) {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    }
    function onInstalled() {
      setInstall(null);
    }
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);

    let disposed = false;
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      const worker = new Serwist("/sw.js", { scope: "/" });
      worker.addEventListener("waiting", () => {
        if (!disposed) setUpdate(worker);
      });
      worker.addEventListener("controlling", () => {
        if (!disposed) setReady(true);
      });
      void worker
        .register()
        .then(async () => {
          await navigator.serviceWorker.ready;
          if (!disposed) setReady(true);
        })
        .catch(() => {
          if (!disposed) setFailed(true);
        });
    }

    return () => {
      disposed = true;
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!install) return;
    try {
      await install.prompt();
    } finally {
      setInstall(null);
    }
  }

  function updateApp() {
    if (!update) return;
    update.addEventListener("controlling", () => window.location.reload());
    update.messageSkipWaiting();
  }

  return (
    <aside aria-label={t`Приложение`}>
      {!online && (
        <p role="status">{t`Нет интернета. Доступны сохранённые на устройстве данные.`}</p>
      )}
      {ready && <p role="status">{t`Приложение готово к запуску без интернета.`}</p>}
      {failed && (
        <p role="alert">{t`Не удалось подготовить приложение для работы без интернета.`}</p>
      )}
      {install && (
        <button type="button" onClick={() => void installApp()}>{t`Установить приложение`}</button>
      )}
      {update && <button type="button" onClick={updateApp}>{t`Обновить приложение`}</button>}
    </aside>
  );
}
