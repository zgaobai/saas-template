import { localeRedirect } from "@/i18n/server-routing";
import { unlocalizedPathname } from "@/i18n/routing";
import { getPublicSite } from "@/modules/seo/server/site";
import { publicPaths } from "@/modules/seo/metadata";
import {
  createStartHandler,
  defaultStreamHandler,
  createServerEntry,
} from "@tanstack/react-start/server";
const handler = createStartHandler(defaultStreamHandler);
const web = createServerEntry({
  async fetch(request, options) {
    const result = localeRedirect(request) ?? (await handler(request, options));
    const response = new Response(result.body, result);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    );
    // SSR and server functions may contain user data, even on a public tool route.
    response.headers.set("Cache-Control", "private, no-store");
    const path = unlocalizedPathname(new URL(request.url).pathname);
    if (
      !getPublicSite().indexable ||
      !publicPaths.includes(path) ||
      response.status >= 400
    )
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  },
});

export default {
  ...web,
  async scheduled(controller: ScheduledController) {
    const { runScheduledMaintenance } = await import("@/server/maintenance");
    await runScheduledMaintenance(controller.cron);
  },
};
