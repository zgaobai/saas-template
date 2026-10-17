import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/modules/auth/server/auth";
import { endpoint } from "@/server/http";
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => endpoint(() => auth().handler(request)),
      POST: ({ request }) => endpoint(() => auth().handler(request)),
    },
  },
});
