import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Keep Rspack's generated chunks intact. Vercel includes them via includeFiles.
const entryUrl = pathToFileURL(resolve("dist/server/index.js")).href;
const serverEntry: Promise<{
  default: { fetch(request: Request): Response | Promise<Response> };
}> = import(entryUrl);

export default {
  async fetch(request: Request): Promise<Response> {
    const { default: server } = await serverEntry;
    const response = await server.fetch(request);
    // SSR can contain user session data; only the anonymous shell is static.
    // Responses returned by fetch have immutable headers. Rewrap the stream
    // instead of mutating the upstream response or buffering its body.
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
