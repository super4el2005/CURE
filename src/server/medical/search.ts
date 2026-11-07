import "@tanstack/react-start/server-only";
import type { Locale } from "@/src/lib/locale";
import { isMedicalSource } from "@/src/lib/medical-catalog";
import type { MedicalSearch } from "@/src/lib/medical-catalog";
import { MedicalApiError } from "@/src/server/medical/http";
import { createMedicalProviders } from "@/src/server/medical/providers";

export function createMedicalHandler(search = createMedicalProviders()) {
  const cache = new Map<string, { until: number; result: Awaited<ReturnType<typeof search>> }>();
  const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof search>>>>();
  return async (request: Request, locale: Locale) => {
    const respond = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return respond({ error: "FORBIDDEN_ORIGIN" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return respond({ error: "INVALID_REQUEST" }, 415);
    try {
      const content = await request.text();
      if (content.length > 2048) return respond({ error: "INVALID_SEARCH" }, 400);
      const body: unknown = JSON.parse(content);
      if (
        !body ||
        typeof body !== "object" ||
        !("source" in body) ||
        !isMedicalSource(body.source) ||
        !("query" in body) ||
        typeof body.query !== "string"
      )
        return respond({ error: "INVALID_SEARCH" }, 400);
      const query = body.query.trim();
      if (query.length > 100 || (body.source !== "osm" && query.length < 2))
        return respond({ error: "INVALID_SEARCH" }, 400);
      const input: MedicalSearch = { source: body.source, query };
      if (body.source === "osm") {
        const coordinates = body as Record<string, unknown>;
        for (const name of ["latitude", "longitude", "radius"] as const) {
          if (typeof coordinates[name] !== "number" || !Number.isFinite(coordinates[name]))
            return respond({ error: "INVALID_SEARCH" }, 400);
          input[name] = coordinates[name] as number;
        }
        if (
          Math.abs(input.latitude!) > 90 ||
          Math.abs(input.longitude!) > 180 ||
          input.radius! < 100 ||
          input.radius! > 10000
        )
          return respond({ error: "INVALID_SEARCH" }, 400);
      }
      const key = JSON.stringify([input, locale]);
      const cached = cache.get(key);
      if (cached && cached.until > Date.now()) return respond(cached.result);
      let work = inFlight.get(key);
      if (!work) {
        work = search(input, locale)
          .then((result) => {
            if (cache.size >= 100) cache.delete(cache.keys().next().value!);
            cache.set(key, { until: Date.now() + 60_000, result });
            return result;
          })
          .finally(() => {
            inFlight.delete(key);
          });
        inFlight.set(key, work);
      }
      return respond(await work);
    } catch (error) {
      if (error instanceof MedicalApiError)
        return respond({ error: error.code, ...error.details }, error.status);
      if (error instanceof SyntaxError) return respond({ error: "INVALID_SEARCH" }, 400);
      return respond({ error: "SOURCE_UNAVAILABLE" }, 502);
    }
  };
}
export const handleMedicalSearch = createMedicalHandler();
