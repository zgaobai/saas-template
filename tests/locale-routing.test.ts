import { describe, it, expect, vi } from "vitest";
import {
  createLocaleRewrite,
  languagePath,
  pathLocale,
  unlocalizedPathname,
  isPagePath,
} from "@/i18n/routing";
import { safeReturnTo } from "@/modules/tools/catalog";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { localeRedirect } from "@/i18n/server-routing";

describe("language path routing", () => {
  it("uses prefix paths and preserves non-language query parameters", () => {
    expect(languagePath("/", "zh")).toBe("/zh/");
    expect(languagePath("/en/billing?section=orders&lang=en", "zh")).toBe(
      "/zh/billing?section=orders",
    );
    expect(
      languagePath("/tools/translate?auth=login&next=%2Fbilling", "en"),
    ).toBe("/en/tools/translate?auth=login&next=%2Fbilling");
    expect(pathLocale("/english")).toBeUndefined();
    expect(unlocalizedPathname("/zh/")).toBe("/");
  });
  it("rewrites one typed route tree without mutating input URLs or shared locale state", () => {
    const zh = createLocaleRewrite(() => "zh"),
      en = createLocaleRewrite(() => "en");
    const publicUrl = new URL(
      "https://app.test/zh/admin/users/example?section=ledger&lang=en",
    );
    const internal = zh.input({ url: publicUrl });
    expect(internal.pathname).toBe("/admin/users/example");
    expect(internal.searchParams.get("lang")).toBe("zh");
    expect(publicUrl.pathname).toBe("/zh/admin/users/example");
    const link = new URL("https://app.test/pricing?auth=login");
    expect(zh.output({ url: link }).pathname).toBe("/zh/pricing");
    expect(en.output({ url: link }).pathname).toBe("/en/pricing");
    expect(link.pathname).toBe("/pricing");
    const switching = zh.output({
      url: new URL("https://app.test/billing?lang=en&section=orders"),
    });
    expect(switching.pathname).toBe("/en/billing");
    expect(switching.search).toBe("?section=orders");
  });
  it("does not localize API, webhook, server function or asset paths", () => {
    const rewrite = createLocaleRewrite(() => "zh");
    for (const path of [
      "/api/auth/sign-in/email",
      "/api/webhooks/pancake",
      "/_server/test",
      "/_serverFn/example",
      "/@react-refresh",
      "/__vite_ping",
      "/assets/main.js",
      "/favicon.svg",
      "/robots.txt",
      "/sitemap.xml",
      "/@vite/client",
    ]) {
      expect(isPagePath(path)).toBe(false);
      const url = new URL(path, "https://app.test");
      expect(rewrite.output({ url }).href).toBe(url.href);
      expect(localeRedirect(new Request(url))).toBeUndefined();
    }
    const prefixedApi = new URL("https://app.test/en/api/health");
    expect(rewrite.input({ url: prefixedApi }).pathname).toBe("/en/api/health");
  });
  it("redirects legacy URLs and makes path language authoritative", () => {
    const legacy = localeRedirect(
      new Request("https://app.test/billing?lang=zh&order=example", {
        headers: { cookie: "qihang-locale=en" },
      }),
    )!;
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get("location")).toBe(
      "https://app.test/zh/billing?order=example",
    );
    const prefix = localeRedirect(
      new Request("https://app.test/en/pricing?lang=zh"),
    )!;
    expect(prefix.headers.get("location")).toBe("https://app.test/en/pricing");
    const home = localeRedirect(
      new Request("https://app.test/", {
        headers: { cookie: "qihang-locale=zh" },
      }),
    )!;
    expect(home.status).toBe(302);
    expect(home.headers.get("location")).toBe("https://app.test/zh/");
    expect(home.headers.get("cache-control")).toContain("no-store");
    expect(localeRedirect(new Request("https://app.test/zh/"))).toBeUndefined();
    expect(
      localeRedirect(new Request("https://app.test/zh"))?.headers.get(
        "location",
      ),
    ).toBe("https://app.test/zh/");
    expect(
      localeRedirect(
        new Request("https://app.test/billing", { method: "POST" }),
      ),
    ).toBeUndefined();
  });
  it("accepts localized login return pages without allowing external redirects", () => {
    expect(safeReturnTo("/en/billing")).toBe("/billing");
    expect(safeReturnTo("/zh/tools/copywriting")).toBe("/tools/copywriting");
    for (const value of [
      "//evil.example",
      "https://evil.example",
      "/en//evil.example",
      "/zh/api/auth",
    ])
      expect(safeReturnTo(value)).toBe("/");
  });
});
