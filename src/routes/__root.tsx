import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { I18nProvider } from "@lingui/react";
import { useLingui } from "@lingui/react/macro";
import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { NavigationProgress } from "@mantine/nprogress";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { Outlet, Scripts, HeadContent } from "@tanstack/react-router";

import "@mantine/notifications/styles.css";
import "@mantine/nprogress/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";

import { createServerFn } from "@tanstack/react-start";
import * as React from "react";

import { PwaControls } from "@/src/components/pwa-controls";
import { createI18n } from "@/src/i18n";
import { authClient } from "@/src/lib/auth-client";
import { getToken } from "@/src/lib/auth-server";
import { defaultLocale, lastLocaleKey } from "@/src/lib/locale";
import { getRequestDevice } from "@/src/lib/request-device";
import { getRequestLocale } from "@/src/lib/request-locale";

import mantineCoreStyles from "@mantine/core/styles.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => getToken());

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  isShell: () => boolean;
}>()({
  beforeLoad: async ({ context }) => {
    // Client authentication is managed by Better Auth. A prerendered shell
    // contains no user tokens and must not require a live auth backend.
    if (typeof window !== "undefined" || context.isShell()) {
      return { token: undefined, isAuthenticated: false };
    }
    const token = await getAuth();
    const httpClient = context.convexQueryClient.serverHttpClient;
    if (token) httpClient?.setAuth(token);
    else httpClient?.clearAuth();

    return { token, isAuthenticated: Boolean(token) };
  },
  // The build-time shell transports root loader data too. Give its client
  // bootstrap a different match identity so locale/device are resolved locally
  // even when opening the exact same URL that was prerendered.
  loaderDeps: () => ({
    fromOfflineShell:
      typeof document !== "undefined" && document.documentElement.dataset.offlineShell === "true",
  }),
  loader: ({ context }) => ({
    locale: typeof window === "undefined" && context.isShell() ? defaultLocale : getRequestLocale(),
    device: typeof window === "undefined" && context.isShell() ? undefined : getRequestDevice(),
  }),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Cure",
      },
      { name: "theme-color", content: "#0f766e" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Cure" },
    ],
    links: [
      { rel: "stylesheet", href: mantineCoreStyles },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  // Start serializes loader data for hydration, so both environments use
  // the same locale without relying on browser-only language detection.
  const { locale } = Route.useLoaderData();
  const i18n = React.useMemo(() => createI18n(locale), [locale]);
  React.useEffect(() => {
    try {
      localStorage.setItem(lastLocaleKey, locale);
    } catch {
      // A blocked store must not prevent rendering or navigation.
    }
  }, [locale]);
  const { token, convexQueryClient } = Route.useRouteContext();

  return (
    <ConvexBetterAuthProvider
      client={convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={token ?? null}
    >
      <I18nProvider i18n={i18n}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </I18nProvider>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { i18n } = useLingui();
  const { isShell } = Route.useRouteContext();
  const { device } = Route.useLoaderData();

  return (
    <html
      lang={i18n.locale}
      data-device={device}
      data-offline-shell={isShell() ? "true" : undefined}
      {...mantineHtmlProps}
    >
      <head>
        <ColorSchemeScript />
        <HeadContent />
      </head>
      <body>
        <MantineProvider>
          <ModalsProvider>
            <PwaControls />
            {children}
          </ModalsProvider>
          <NavigationProgress />
          <Notifications />
        </MantineProvider>
        <Scripts />
      </body>
    </html>
  );
}
