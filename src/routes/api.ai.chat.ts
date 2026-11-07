import { createFileRoute } from "@tanstack/react-router";

import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/src/lib/auth-server";
import { handleAiChat } from "@/src/server/ai-chat";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleAiChat(request, async () =>
          Boolean(await fetchAuthQuery(api.auth.getCurrentUser, {})),
        ),
    },
  },
});
