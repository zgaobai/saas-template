import { createTranslator, localizedPath, type Locale } from "@/i18n/core";
import { posts } from "@/modules/blog/catalog";
import { site } from "@/site";
import { tools } from "@/modules/tools/catalog";
export type PublicSite = {
  origin: string;
  indexable: boolean;
  locale?: Locale;
  analytics?: {
    gaMeasurementId?: string;
    umamiWebsiteId?: string;
    umamiScriptUrl?: string;
  };
};
export const publicPaths = [
  "/",
  "/pricing",
  "/blog",
  ...posts.map((post) => `/blog/${post.slug}`),
  ...tools.map((tool) => `/tools/${tool.id}`),
];
export function websiteEnvironment(
  appUrl: string,
  production: boolean,
  analytics?: PublicSite["analytics"],
): PublicSite {
  const url = new URL(appUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const indexable = production && url.protocol === "https:" && !local;
  return {
    origin: url.origin,
    indexable,
    analytics: indexable ? analytics : undefined,
  };
}
export function pageHead(
  page: {
    title: string;
    description: string;
    path: string;
    type?: "website" | "article";
  },
  environment: PublicSite,
) {
  const locale = environment.locale ?? "zh";
  const tr = createTranslator(locale);
  const canonical = new URL(
    localizedPath(page.path, locale),
    environment.origin,
  ).href;
  const title = page.title
    .split(" · ")
    .map((part) => tr(part))
    .join(" · ")
    .replaceAll(site.name, tr(site.name));
  const description = tr(page.description);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: page.type ?? "website" },
      { property: "og:site_name", content: tr(site.name) },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:locale", content: locale === "en" ? "en_US" : "zh_CN" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(environment.indexable
        ? [{ property: "og:url", content: canonical }]
        : []),
    ],
    links: environment.indexable
      ? [
          { rel: "canonical", href: canonical },
          ...(["zh", "en"] as const).map((lang) => ({
            rel: "alternate",
            hreflang: lang === "zh" ? "zh-CN" : "en",
            href: new URL(localizedPath(page.path, lang), environment.origin)
              .href,
          })),
        ]
      : [],
  };
}
const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function sitemapXml(environment: PublicSite) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    (environment.indexable
      ? publicPaths
          .map((path) =>
            (["zh", "en"] as const)
              .map(
                (lang) =>
                  `<url><loc>${escapeXml(new URL(localizedPath(path, lang), environment.origin).href)}</loc></url>`,
              )
              .join(""),
          )
          .join("")
      : "") +
    "</urlset>"
  );
}
export function robotsText(environment: PublicSite) {
  if (!environment.indexable) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /llms.txt",
    "Allow: /llms-full.txt",
    ...[
      "/api/",
      "/_server/",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/dashboard",
      "/account",
      "/subscriptions",
      "/history",
      "/files",
      "/billing",
      "/settings",
      "/admin",
    ]
      .flatMap((path) => [
        path,
        ...(["zh", "en"] as const).map((lang) => localizedPath(path, lang)),
      ])
      .map((path) => `Disallow: ${path}`),
    "",
    "# Generative Engine Optimization (GEO)",
    "User-agent: GPTBot",
    "Allow: /",
    "Allow: /llms.txt",
    "Allow: /llms-full.txt",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "Allow: /llms.txt",
    "Allow: /llms-full.txt",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "Allow: /llms.txt",
    "Allow: /llms-full.txt",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "",
    `Sitemap: ${environment.origin}/sitemap.xml`,
    "",
  ].join("\n");
}
