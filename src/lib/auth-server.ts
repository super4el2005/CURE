import "@tanstack/react-start/server-only";
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    convexUrl: import.meta.env.CONVEX_URL,
    convexSiteUrl: import.meta.env.CONVEX_SITE_URL,
  });
