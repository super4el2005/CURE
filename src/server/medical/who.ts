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
    const clientId = env.WHO_ICD_CLIENT_ID?.trim();
    const secret = env.WHO_ICD_CLIENT_SECRET?.trim();
    if (!clientId || !secret) throw new MedicalApiError("SOURCE_NOT_CONFIGURED", 503);
    refreshing ??= (async () => {
      const data = await jsonFetch(fetchImpl, "https://icdaccessmanagement.who.int/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`, "utf8").toString("base64")}`,
        },
        body: new URLSearchParams({
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
    })()
      .catch((error: unknown) => {
        throw whoError(error, "token");
      })
      .finally(() => {
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
    const lookup = async (bearer: string) =>
      jsonFetch(
        fetchImpl,
        url,
        {
          headers: {
            Authorization: `Bearer ${bearer}`,
            "API-Version": "v2",
            "Accept-Language": language,
            Accept: "application/json",
          },
        },
        isTen,
      );
    const bearer = await accessToken();
    let data;
    try {
      data = await lookup(bearer);
    } catch (error) {
      if (!(error instanceof MedicalApiError) || error.details.upstreamStatus !== 401)
        throw whoError(error, "lookup");
      // The upstream may revoke a token before its advertised expiry. Refresh once,
      // without invalidating a newer token obtained by a concurrent request.
      if (token?.value === bearer) token = undefined;
      const renewed = await accessToken();
      try {
        data = await lookup(renewed);
      } catch (retryError) {
        throw whoError(retryError, "lookup");
      }
    }
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

function whoError(error: unknown, stage: "token" | "lookup") {
  if (!(error instanceof MedicalApiError))
    return new MedicalApiError("SOURCE_UNAVAILABLE", 502, { stage });
  const upstreamStatus = error.details.upstreamStatus;
  const authFailed =
    upstreamStatus === 401 ||
    upstreamStatus === 403 ||
    (stage === "token" && upstreamStatus === 400);
  return new MedicalApiError(
    authFailed ? "SOURCE_AUTH_FAILED" : error.code,
    authFailed ? 503 : error.status,
    { ...error.details, stage },
  );
}
