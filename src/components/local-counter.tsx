import { useLingui } from "@lingui/react/macro";
import { createCollection, localStorageCollectionOptions } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { ClientOnly } from "@tanstack/react-router";
import { useState } from "react";

type Counter = { id: string; count: number };

function createCounterCollection() {
  return createCollection(
    localStorageCollectionOptions<Counter>({
      id: "cure-device-demo-counter-v1",
      storageKey: "cure.device-demo-counter.v1",
      getKey: (row) => row.id,
    }),
  );
}

let counterCollection: ReturnType<typeof createCounterCollection> | undefined;

function DeviceCounter() {
  const { t } = useLingui();
  const [collection] = useState(() => {
    try {
      return (counterCollection ??= createCounterCollection());
    } catch {
      return undefined;
    }
  });
  const { data } = useLiveQuery(() => collection);
  const [error, setError] = useState(false);
  const count = data?.find((row) => row.id === "counter")?.count ?? 0;

  async function increment() {
    if (!collection) return;
    setError(false);
    try {
      const row = collection.get("counter");
      const transaction = row
        ? collection.update("counter", (draft) => {
            draft.count += 1;
          })
        : collection.insert({ id: "counter", count: 1 });
      await transaction.when("settled");
    } catch {
      setError(true);
    }
  }

  return (
    <section>
      {!collection ? (
        <p role="alert">{t`Не удалось открыть локальное хранилище.`}</p>
      ) : (
        <>
          <p>{t`Демонстрационный счётчик сохраняется только на этом устройстве.`}</p>
          <button
            type="button"
            onClick={() => void increment()}
          >{t`Добавить 1 к ${count}?`}</button>
          {error && <p role="alert">{t`Не удалось сохранить изменение на устройстве.`}</p>}
        </>
      )}
    </section>
  );
}

export function LocalCounter() {
  return (
    <ClientOnly>
      <DeviceCounter />
    </ClientOnly>
  );
}
