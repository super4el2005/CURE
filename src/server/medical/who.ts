import "@tanstack/react-start/server-only";
import type { Locale } from "@/src/lib/locale";
import type { MedicalRecord, MedicalSearch } from "@/src/lib/medical-catalog";
import {
  jsonFetch,
  MedicalApiError,
  object,
  plainText,
  rows,
  safeUrl,
  text,
} from "@/src/server/medical/http";

export function createWhoClient(
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
) {
  let token: { value: string; expiresAt: number } | undefined;
  let refreshing: Promise<string> | undefined;
  async function accessToken() {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const clientId = env.WHO_ICD_CLIENT_ID;
    const secret = env.WHO_ICD_CLIENT_SECRET;
    if (!clientId || !secret) throw new MedicalApiError("SOURCE_NOT_CONFIGURED", 503);
    refreshing ??= (async () => {
      const data = await jsonFetch(fetchImpl, "https://icdaccessmanagement.who.int/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: secret,
          scope: "icdapi_access",
          grant_type: "client_credentials",
        }),
      });
      if (
        !text(data.access_token) ||
        typeof data.expires_in !== "number" ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      )
        throw new MedicalApiError("INVALID_SOURCE_RESPONSE");
      token = { value: text(data.access_token), expiresAt: Date.now() + data.expires_in * 1000 };
      return token.value;
    })().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  }
  return async (
    input: MedicalSearch,
    locale: Locale,
    stamp: string,
  ): Promise<{ records: MedicalRecord[]; total: number | null; language: string }> => {
    const isTen = input.source === "icd10";
    const language = isTen ? "en" : locale;
    const release = isTen ? "2019" : "2026-01";
    if (isTen && !/^[a-z]\d{2}(?:\.[a-z0-9]{1,4})?$/i.test(input.query))
      throw new MedicalApiError("INVALID_SEARCH", 400);
    const url = new URL(
      isTen
        ? `https://id.who.int/icd/release/10/${release}/${input.query.toUpperCase()}`
        : `https://id.who.int/icd/release/11/${release}/mms/search`,
    );
    if (!isTen) {
      url.searchParams.set("q", input.query);
      url.searchParams.set("useFlexisearch", "true");
      url.searchParams.set("flatResults", "true");
    }
    const data = await jsonFetch(
      fetchImpl,
      url,
      {
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          "API-Version": "v2",
          "Accept-Language": language,
          Accept: "application/json",
        },
      },
      isTen,
    );
    const items = isTen ? (Object.keys(data).length ? [data] : []) : rows(data.destinationEntities);
    const records = items.slice(0, 20).map((entity) => {
      const title =
        isTen && typeof entity.title === "object" ? object(entity.title)["@value"] : entity.title;
      const sourceId = text(entity.id) || text(entity["@id"]) || url.href;
      return {
        id: `${input.source}:${release}:${sourceId}:${language}`,
        source: input.source,
        sourceId,
        title: plainText(title),
        code: text(entity.theCode) || text(entity.code) || (isTen ? input.query.toUpperCase() : ""),
        description: "",
        url: safeUrl(sourceId),
        dataLanguage: language,
        version: release,
        fetchedAt: stamp,
        country: "",
        latitude: null,
        longitude: null,
      };
    });
    return {
      records,
      total: isTen
        ? items.length
        : typeof data.resultChopped === "boolean" && data.resultChopped
          ? null
          : items.length,
      language,
    };
  };
}
