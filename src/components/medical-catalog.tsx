import { useLingui } from "@lingui/react/macro";
import { useLiveQuery } from "@tanstack/react-db";
import { useMutation } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { useState } from "react";

import { createMedicalCache, saveMedicalRecords } from "@/src/lib/medical-cache";
import {
  filterMedicalRecords,
  isMedicalSource,
  medicalAttribution,
} from "@/src/lib/medical-catalog";
import type { MedicalResult, MedicalSearch, MedicalSource } from "@/src/lib/medical-catalog";
import { useOnline } from "@/src/lib/network";

function Catalog() {
  const { t } = useLingui();
  const online = useOnline();
  const [source, setSource] = useState<MedicalSource>("ror");
  const [query, setQuery] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("5000");
  const [cacheFailed, setCacheFailed] = useState(false);
  const [collection] = useState(() => {
    try {
      return createMedicalCache(window.localStorage);
    } catch {
      return undefined;
    }
  });
  const { data } = useLiveQuery(() => collection);
  const sourceLabels: Record<MedicalSource, string> = {
    ror: t`Университеты — ROR`,
    osm: t`Больницы и клиники — OpenStreetMap`,
    geofabrik: t`Региональные выгрузки — Geofabrik`,
    icd11: t`МКБ-11 — ВОЗ`,
    icd10: t`МКБ-10 — ВОЗ (по коду)`,
    pubmed: t`Публикации — PubMed`,
    orphadata: t`Редкие заболевания — Orphadata`,
  };
  const search = useMutation({
    mutationKey: ["medical-search"],
    retry: false,
    mutationFn: async (input: MedicalSearch) => {
      setCacheFailed(false);
      const response = await fetch("/api/medical/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) {
        const code = body?.error;
        throw new Error(
          [
            "SOURCE_NOT_CONFIGURED",
            "SOURCE_AUTH_FAILED",
            "SOURCE_RATE_LIMITED",
            "INVALID_SEARCH",
          ].includes(code)
            ? code
            : "SOURCE_UNAVAILABLE",
        );
      }
      const result = body as MedicalResult;
      if (!collection) {
        setCacheFailed(true);
        return result;
      }
      try {
        await saveMedicalRecords(collection, result.records);
      } catch {
        setCacheFailed(true);
      }
      return result;
    },
  });
  const currentInput: MedicalSearch = {
    source,
    query: query.trim(),
    ...(source === "osm"
      ? {
          ...(latitude ? { latitude: Number(latitude) } : {}),
          ...(longitude ? { longitude: Number(longitude) } : {}),
          radius: Number(radius),
        }
      : {}),
  };
  const matchesSearch = JSON.stringify(search.variables) === JSON.stringify(currentInput);
  const resultIds = new Set(matchesSearch ? search.data?.records.map((record) => record.id) : []);
  const records =
    matchesSearch && search.data
      ? (data ?? []).filter((record) => resultIds.has(record.id))
      : filterMedicalRecords(data ?? [], source, query, currentInput).slice(0, 100);
  const visible = cacheFailed && matchesSearch && search.data ? search.data.records : records;
  const attribution = medicalAttribution[source];
  return (
    <section aria-label={t`Медицинские справочники`}>
      <h2>{t`Медицинские справочники`}</h2>
      <p>{t`Загруженные записи доступны без интернета. Это сохранённая часть справочника, а не полная мировая база.`}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (online) search.mutate(currentInput);
        }}
      >
        <label>
          {t`Источник данных`}
          <select
            value={source}
            disabled={search.isPending}
            onChange={(event) => {
              if (isMedicalSource(event.target.value)) {
                setSource(event.target.value);
                search.reset();
                setQuery("");
              }
            }}
          >
            {Object.entries(sourceLabels).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {source === "icd10" ? t`Код МКБ-10, например J45` : t`Название, термин или код`}
          <input
            value={query}
            maxLength={100}
            minLength={source === "osm" ? 0 : 2}
            required={source !== "osm"}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {source === "osm" && (
          <fieldset>
            <legend>{t`Область поиска учреждений`}</legend>
            <label>
              {t`Широта`}
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </label>
            <label>
              {t`Долгота`}
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                required
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </label>
            <label>
              {t`Радиус, метры (до 10 000)`}
              <input
                type="number"
                min={100}
                max={10000}
                required
                value={radius}
                onChange={(event) => setRadius(event.target.value)}
              />
            </label>
          </fieldset>
        )}
        <button type="submit" disabled={!online || search.isPending}>
          {search.isPending ? t`Загружаем…` : t`Найти в источнике`}
        </button>
      </form>
      {(source === "icd10" || source === "orphadata" || source === "pubmed") && (
        <p>{t`Для этого источника используйте английский термин или код. Перевод названий автоматически не выполняется.`}</p>
      )}
      {source === "ror" && (
        <p>{t`ROR содержит организации образования. Наличие в ROR не подтверждает медицинскую аккредитацию.`}</p>
      )}
      {source === "geofabrik" && (
        <p>{t`Здесь доступны ссылки на региональные PBF-выгрузки OSM. Архив не является готовым списком больниц и не загружается в браузер автоматически.`}</p>
      )}
      {!online && (
        <p role="status">{t`Нет сети: поиск выполняется только по сохранённым записям.`}</p>
      )}
      {matchesSearch && search.isSuccess && !!search.data.records.length && !cacheFailed && (
        <p role="status">{t`Полученные записи сохранены на устройстве.`}</p>
      )}
      {cacheFailed && (
        <p role="alert">{t`Не удалось сохранить записи. Показанные результаты могут быть недоступны после закрытия приложения.`}</p>
      )}
      {search.isError && (
        <p role="alert">
          {search.error.message === "SOURCE_NOT_CONFIGURED"
            ? t`Для ВОЗ нужно настроить серверные WHO_ICD_CLIENT_ID и WHO_ICD_CLIENT_SECRET.`
            : search.error.message === "SOURCE_AUTH_FAILED"
              ? t`ВОЗ отклонила доступ. Проверьте ключи WHO ICD API в настройках сервера и повторите деплой.`
              : search.error.message === "SOURCE_RATE_LIMITED"
                ? t`Источник ограничил запросы. Повторите позже.`
                : search.error.message === "INVALID_SEARCH"
                  ? t`Проверьте запрос и параметры поиска.`
                  : t`Источник сейчас недоступен. Сохранённые записи остаются доступны.`}
        </p>
      )}
      {matchesSearch && search.data && (
        <p>
          {t`Язык данных: ${search.data.dataLanguage}.`}{" "}
          {search.data.truncated && t`Показана ограниченная выборка.`}
        </p>
      )}
      {!visible.length && (
        <p>
          {matchesSearch && search.isSuccess
            ? t`В источнике ничего не найдено.`
            : t`Сохранённых записей по этому запросу пока нет.`}
        </p>
      )}
      <ul>
        {visible.map((record) => (
          <li key={record.id}>
            <strong>{record.title}</strong>
            {record.code && ` — ${record.code}`}
            {record.description && <p>{record.description}</p>}
            <p>
              {record.country} {record.dataLanguage} {record.version} ·{" "}
              {record.fetchedAt.slice(0, 10)}
            </p>
            {record.latitude !== null && record.longitude !== null && (
              <p>
                {record.latitude}, {record.longitude}
              </p>
            )}
            {record.url && (
              <a href={record.url} target="_blank" rel="noreferrer noopener">
                {source === "geofabrik" ? t`Скачать PBF из источника` : t`Открыть источник`}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p>
        <a href={attribution.url} target="_blank" rel="noreferrer noopener">
          {attribution.label}
        </a>{" "}
        · {attribution.license}
      </p>
    </section>
  );
}
export function MedicalCatalog() {
  return (
    <ClientOnly>
      <Catalog />
    </ClientOnly>
  );
}
