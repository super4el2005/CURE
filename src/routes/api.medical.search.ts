import { createFileRoute } from "@tanstack/react-router";

import { getRequestLocale } from "@/src/lib/request-locale";
import { handleMedicalSearch } from "@/src/server/medical/search";

export const Route = createFileRoute("/api/medical/search")({
  server: { handlers: { POST: ({ request }) => handleMedicalSearch(request, getRequestLocale()) } },
});
