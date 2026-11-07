import "@tanstack/react-start/server-only";

export class MedicalApiError extends Error {
  constructor(
    public readonly code:
      | "SOURCE_NOT_CONFIGURED"
      | "SOURCE_UNAVAILABLE"
      | "SOURCE_RATE_LIMITED"
      | "INVALID_SEARCH"
      | "INVALID_SOURCE_RESPONSE",
    public readonly status = 502,
  ) {
    super(code);
  }
}
export type Json = Record<string, unknown>;
export function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new MedicalApiError("INVALID_SOURCE_RESPONSE");
  return value as Json;
}
export function rows(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(object) : [];
}
export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export function plainText(value: unknown): string {
  return text(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
export function safeUrl(value: unknown): string {
  try {
    const url = new URL(text(value));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export async function jsonFetch(
  fetchImpl: typeof fetch,
  url: string | URL,
  init: RequestInit = {},
  allowNotFound = false,
): Promise<Json> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch {
    throw new MedicalApiError("SOURCE_UNAVAILABLE");
  }
  if (allowNotFound && response.status === 404) {
    await response.body?.cancel();
    return {};
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new MedicalApiError(
      response.status === 429 ? "SOURCE_RATE_LIMITED" : "SOURCE_UNAVAILABLE",
      response.status === 429 ? 429 : 502,
    );
  }
  try {
    return object(await response.json());
  } catch {
    throw new MedicalApiError("INVALID_SOURCE_RESPONSE");
  }
}
