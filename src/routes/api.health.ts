import { createFileRoute } from "@tanstack/react-router";
import { bindings } from "@/server/env";
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await bindings().DB.prepare("SELECT 1 AS ok").first();
          return Response.json(
            { status: "ok" },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { status: "unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
