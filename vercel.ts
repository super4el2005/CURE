export const config = {
  framework: null,
  buildCommand: "npm run build",
  outputDirectory: "dist/client",
  functions: {
    "api/index.ts": {
      includeFiles: "dist/server/**",
    },
  },
  routes: [
    { src: "/sw.js", headers: { "Cache-Control": "no-cache" }, continue: true },
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/api/index" },
  ],
};
