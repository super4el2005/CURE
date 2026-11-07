import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "@/src/routeTree.gen";

export function getRouter() {
  const CONVEX_URL = import.meta.env.CONVEX_URL;
  if (!CONVEX_URL) {
    throw new Error("Missing CONVEX_URL environment variable");
  }
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL, { expectAuth: true });

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    context: { queryClient, convexQueryClient, isShell: (): boolean => router.isShell() },
    scrollRestoration: true,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
