import { useLingui } from "@lingui/react/macro";
import { useByok } from "@tanstack/ai-react";
import { defineByok, memoryStorage } from "@tanstack/ai-react/byok";
import { createCollection, localStorageCollectionOptions } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useMutation } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { aiProviders, byokProviders, isAiProvider } from "@/src/lib/ai-providers";
import type { AiProvider } from "@/src/lib/ai-providers";
import { authClient } from "@/src/lib/auth-client";
import { useOnline } from "@/src/lib/network";

type Preferences = { id: string; provider: AiProvider; model: string; baseURL: string };
const defaults: Preferences = {
  id: "preferences",
  provider: "gigachat",
  model: "GigaChat",
  baseURL: "",
};

function UserAiSettings({ userId }: { userId: string }) {
  const { t } = useLingui();
  const online = useOnline();
  const [byok] = useState(() => defineByok({ storage: memoryStorage(), providers: byokProviders }));
  const snapshot = useByok(byok);
  const [key, setKey] = useState("");
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [collection] = useState(() => {
    try {
      return createCollection(
        localStorageCollectionOptions<Preferences>({
          id: `cure-ai-preferences-${userId}`,
          storageKey: `cure.ai-preferences.v1.${userId}`,
          getKey: (row) => row.id,
        }),
      );
    } catch {
      return undefined;
    }
  });
  const { data } = useLiveQuery(() => collection);
  const preferences = data?.find((row) => row.id === "preferences") ?? defaults;
  const status = snapshot.status[preferences.provider];
  const hasKey = status?.state === "set";

  useEffect(
    () => () => {
      abortRef.current?.abort();
      void byok.clear();
    },
    [byok],
  );

  const check = useMutation({
    mutationKey: ["ai-connection-check", userId],
    retry: false,
    mutationFn: async () => {
      abortRef.current = new AbortController();
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(preferences.provider === "gigachat" ? {} : byok.headers(preferences.provider)),
        },
        body: JSON.stringify({
          ...preferences,
          messages: [{ role: "user", content: "Reply with OK." }],
        }),
        signal: abortRef.current.signal,
      });
      if (!response.ok) throw new Error("AI connection failed");
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("text" in body) ||
        typeof body.text !== "string"
      )
        throw new Error("Invalid AI response");
      return true;
    },
  });

  async function update(patch: Partial<Preferences>) {
    if (!collection) return;
    setFailed(false);
    setKey("");
    check.reset();
    try {
      const transaction = collection.get("preferences")
        ? collection.update("preferences", (draft) => {
            Object.assign(draft, patch);
          })
        : collection.insert({ ...defaults, ...patch });
      await transaction.when("settled");
    } catch {
      setFailed(true);
    }
  }

  if (!collection) return <p role="alert">{t`Не удалось открыть настройки AI на устройстве.`}</p>;
  return (
    <section aria-label={t`Настройки AI`}>
      <h2>{t`Нейросеть`}</h2>
      <label>
        {t`Провайдер`}
        <select
          value={preferences.provider}
          disabled={check.isPending}
          onChange={(event) => {
            const selected = event.target.value;
            if (isAiProvider(selected))
              void update({
                provider: selected,
                model: aiProviders.find((item) => item.id === selected)?.model ?? "",
                baseURL: "",
              });
          }}
        >
          {aiProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>
      {preferences.provider === "gigachat" ? (
        <p>{t`По умолчанию используется ГигаЧат. Свой ключ не требуется.`}</p>
      ) : (
        <>
          <label>
            {t`Модель`}
            <input
              value={preferences.model}
              disabled={check.isPending}
              onChange={(event) => void update({ model: event.target.value })}
            />
          </label>
          {preferences.provider === "custom" && (
            <label>
              {t`Адрес API`}
              <input
                type="url"
                value={preferences.baseURL}
                placeholder="https://api.example.com/v1"
                disabled={check.isPending}
                onChange={(event) => void update({ baseURL: event.target.value })}
              />
            </label>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setFailed(false);
              void byok
                .update(preferences.provider, key.trim())
                .then(() => setKey(""))
                .catch(() => setFailed(true));
            }}
          >
            <label>
              {t`API-ключ`}
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={key}
                disabled={check.isPending}
                onChange={(event) => setKey(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={!key.trim() || check.isPending}
            >{t`Использовать ключ`}</button>
            <button
              type="button"
              disabled={!hasKey || check.isPending}
              onClick={() => {
                setKey("");
                check.reset();
                void byok.clear(preferences.provider).catch(() => setFailed(true));
              }}
            >{t`Удалить ключ`}</button>
          </form>
          <p>{t`Ключ хранится только в памяти вкладки. После перезагрузки введите его снова.`}</p>
          {hasKey && <p role="status">{t`Ключ готов к использованию.`}</p>}
        </>
      )}
      <button
        type="button"
        disabled={
          !online ||
          check.isPending ||
          (preferences.provider !== "gigachat" && (!hasKey || !preferences.model.trim()))
        }
        onClick={() => check.mutate()}
      >
        {check.isPending ? t`Проверяем подключение…` : t`Проверить подключение`}
      </button>
      {!online && <p role="status">{t`Для запроса к нейросети нужен интернет.`}</p>}
      {check.isSuccess && <p role="status">{t`Нейросеть ответила. Подключение работает.`}</p>}
      {check.isError && (
        <p role="alert">{t`Не удалось проверить подключение. Проверьте ключ, модель и настройки API.`}</p>
      )}
      {failed && <p role="alert">{t`Не удалось сохранить настройки AI.`}</p>}
    </section>
  );
}

function AuthenticatedAiSettings() {
  const { t } = useLingui();
  const { data: session } = authClient.useSession();
  return session ? (
    <UserAiSettings key={session.user.id} userId={session.user.id} />
  ) : (
    <p>{t`Войдите, чтобы настроить нейросеть.`}</p>
  );
}

export function AiSettings() {
  return (
    <ClientOnly>
      <AuthenticatedAiSettings />
    </ClientOnly>
  );
}
