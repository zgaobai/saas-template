import type { Locale } from "./core";
export function pathLocale(pathname: string): Locale | undefined {
  const match = /^\/(zh|en)(?:\/|$)/.exec(pathname);
  return match?.[1] as Locale | undefined;
}
export function unlocalizedPathname(pathname: string) {
  return pathLocale(pathname)
    ? pathname.replace(/^\/(?:zh|en)(?=\/|$)/, "") || "/"
    : pathname;
}
export function isPagePath(pathname: string) {
  const path = unlocalizedPathname(pathname);
  return (
    !/^\/[_@]/.test(path) &&
    !/^\/(?:api|_server|_build|assets|@vite|@id|@fs|node_modules|src)(?:\/|$)/.test(
      path,
    ) &&
    !/\.[^/]+\/?$/.test(path)
  );
}
export function languagePath(path: string, locale: Locale) {
  const url = new URL(path, "https://locale.invalid");
  url.pathname = `/${locale}${unlocalizedPathname(url.pathname)}`;
  url.searchParams.delete("lang");
  return url.pathname + url.search + url.hash;
}
/** Keep one typed route tree. Only page URLs expose language prefixes. */
export function createLocaleRewrite(currentLocale: () => Locale) {
  return {
    input: ({ url }: { url: URL }) => {
      const result = new URL(url);
      const locale = pathLocale(result.pathname);
      if (locale && isPagePath(result.pathname)) {
        result.pathname = unlocalizedPathname(result.pathname);
        result.searchParams.set("lang", locale);
      }
      return result;
    },
    output: ({ url }: { url: URL }) => {
      const result = new URL(url);
      if (!isPagePath(result.pathname)) return result;
      const value = result.searchParams.get("lang");
      const locale = value === "zh" || value === "en" ? value : currentLocale();
      return new URL(
        languagePath(result.pathname + result.search + result.hash, locale),
        result.origin,
      );
    },
  };
}
