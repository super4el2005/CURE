declare module "*.po" {
  import type { Messages } from "@lingui/core";
  export const messages: Messages;
}
interface ImportMetaEnv {
  readonly CONVEX_URL: string;
  readonly CONVEX_SITE_URL: string;
}
