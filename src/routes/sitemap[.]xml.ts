import { createFileRoute } from "@tanstack/react-router";
import { sitemapXml } from "@/modules/seo/metadata";
import { getPublicSite } from "@/modules/seo/server/site";
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(sitemapXml(getPublicSite()), {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        }),
    },
  },
});
