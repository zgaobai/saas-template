import { createFileRoute } from "@tanstack/react-router";
import { generateLlmsText } from "@/modules/seo/geo";
import { getPublicSite } from "@/modules/seo/server/site";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(generateLlmsText(getPublicSite()), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        }),
    },
  },
});
