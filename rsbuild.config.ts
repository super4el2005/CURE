import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { defineConfig, loadEnv } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginReact } from "@rsbuild/plugin-react";
import { RsdoctorRspackPlugin } from "@rsdoctor/core";
import { InjectManifest } from "@serwist/webpack-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";

// Convex's deployment URL is public and is needed by both client and SSR.
const { publicVars } = loadEnv({ prefixes: ["CONVEX_URL", "CONVEX_SITE_URL"] });
const shellRevision = randomUUID();
const linguiConfigPath = resolve(import.meta.dirname, "lingui.config.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  source: {
    define: publicVars,
  },
  server: {
    port: 3000,
  },
  dev: {
    watchFiles: [{ paths: [linguiConfigPath], type: "restart" }],
  },
  plugins: [
    pluginBabel({
      babelLoaderOptions: (_config, { addPlugins }) => {
        addPlugins(["@lingui/babel-plugin-lingui-macro"]);
      },
    }),
    pluginReact(),
    tanstackStart({
      spa: { enabled: true, prerender: { outputPath: "/_shell.html" } },
    }),
  ],
  tools: {
    rspack: (config, { environment, isProd }) => {
      config.module ??= {};
      config.module.rules ??= [];
      config.module.rules.push({
        test: /\.po$/,
        type: "javascript/auto",
        use: [
          {
            loader: "@lingui/loader",
            options: { config: linguiConfigPath, failOnCompileError: true },
          },
        ],
      });
      config.plugins ??= [];
      if (isProd && environment.name === "client") {
        config.plugins.push(
          new InjectManifest({
            swSrc: resolve(import.meta.dirname, "src/sw.ts"),
            swDest: "sw.js",
            exclude: [/\.map$/, /\.html$/],
            additionalPrecacheEntries: [{ url: "/_shell.html", revision: shellRevision }],
          }),
        );
      }
      if (process.env.RSDOCTOR === "true") {
        config.plugins.push(new RsdoctorRspackPlugin({}));
      }
    },
  },
});
