import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { DesktopHome } from "@/src/routes/-index.desktop";
import { MobileHome } from "@/src/routes/-index.mobile";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { device } = rootRoute.useLoaderData();
  // The prerendered PWA shell is anonymous and has no device-specific page.
  if (device === undefined) return null;
  return device === "mobile" ? <MobileHome /> : <DesktopHome />;
}
