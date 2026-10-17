import { createFileRoute } from "@tanstack/react-router";
import { robotsText } from "@/modules/seo/metadata";
import { getPublicSite } from "@/modules/seo/server/site";
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(robotsText(getPublicSite()), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
