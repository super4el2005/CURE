import { StartClient } from "@tanstack/react-start/client";
import { startTransition, StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

startTransition(() => {
  const app = (
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
  if (document.documentElement.dataset.offlineShell === "true") {
    // The generic offline shell can be served for a different URL and locale.
    // Render it on the client rather than hydrating unrelated static markup.
    createRoot(document).render(app);
  } else {
    hydrateRoot(document, app);
  }
});
