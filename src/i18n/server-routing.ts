import "@tanstack/react-start/server-only";
import { localeFromRequest, resolveLocale } from "./core";
import { isPagePath, languagePath, pathLocale } from "./routing";
export function localeRedirect(request: Request): Response | undefined {
  if (!["GET", "HEAD"].includes(request.method)) return;
  const url = new URL(request.url);
  if (!isPagePath(url.pathname)) return;
  const prefix = pathLocale(url.pathname);
  const locale =
    prefix ??
    resolveLocale(url.searchParams.get("lang"), localeFromRequest(request));
  const target = new URL(
    languagePath(url.pathname + url.search, locale),
    url.origin,
  );
  if (target.href === url.href) return;
  return new Response(null, {
    status: prefix || url.searchParams.has("lang") ? 308 : 302,
    headers: {
      Location: target.href,
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Accept-Language",
    },
  });
}
