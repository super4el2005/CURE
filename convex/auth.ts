import { createClient } from "@convex-dev/better-auth";
import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";

import { components } from "@/convex/_generated/api";
import type { DataModel } from "@/convex/_generated/dataModel";
import { query } from "@/convex/_generated/server";
import authConfig from "@/convex/auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Convex environment variable: ${name}`);
  return value;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  const siteUrl = requireEnv("SITE_URL");

  return betterAuth({
    appName: "Cure",
    baseURL: siteUrl,
    secret: requireEnv("BETTER_AUTH_SECRET"),
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    socialProviders: {
      google: {
        clientId: requireEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      },
    },
    plugins: [convex({ authConfig })],
  });
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    // Return profile fields only; account tokens and session records stay private.
    return { id: user._id, name: user.name, email: user.email, image: user.image };
  },
});
