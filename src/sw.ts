/// <reference lib="webworker" />

import { NavigationRoute, NetworkOnly, PrecacheFallbackPlugin, Serwist } from "serwist";
import type { PrecacheEntry } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
});

// Never store personalized SSR documents or authentication/API responses.
// Only failed document navigations fall back to the anonymous build-time shell.
serwist.registerRoute(
  new NavigationRoute(
    new NetworkOnly({
      networkTimeoutSeconds: 4,
      plugins: [new PrecacheFallbackPlugin({ fallbackUrls: ["/_shell.html"], serwist })],
    }),
    {
      denylist: [/^\/(?:api|_serverFn|\.well-known)(?:\/|$)/],
    },
  ),
);

serwist.addEventListeners();
