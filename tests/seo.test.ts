import { describe, it, expect } from "vitest";
import {
  websiteEnvironment,
  sitemapXml,
  robotsText,
  pageHead,
} from "../src/modules/seo/metadata";
describe("public indexing boundaries", () => {
  it("never indexes development or local deployments", () => {
    for (const [url, production] of [
      ["http://127.0.0.1:4317", true],
      ["https://localhost", true],
      ["https://preview.example.test", false],
    ] as const) {
      const env = websiteEnvironment(url, production);
      expect(env.indexable).toBe(false);
      expect(sitemapXml(env)).not.toContain("<url>");
      expect(robotsText(env)).toBe("User-agent: *\nDisallow: /\n");
      expect(
        pageHead({ title: "测试", description: "测试", path: "/" }, env).links,
      ).toEqual([]);
    }
  });
  it("uses the configured production origin and excludes private routes", () => {
    const env = websiteEnvironment("https://tools.example.test", true);
    const xml = sitemapXml(env);
    expect(xml).toContain("https://tools.example.test/zh/tools/translate");
    expect(xml).not.toMatch(/dashboard|login|admin|localhost/);
    expect(xml).toContain(
      "https://tools.example.test/zh/blog/write-better-ai-prompts",
    );
    expect(xml).not.toContain("https://tools.example.test/tools</loc>");
    expect(xml).not.toContain("https://tools.example.test/faq</loc>");
    expect(xml).not.toContain("/guide");
    expect(xml).not.toContain("#");
    expect(robotsText(env)).toContain("Disallow: /api/");
    expect(
      pageHead(
        { title: "翻译", description: "翻译文本", path: "/tools/translate" },
        env,
      ).links,
    ).toEqual([
      {
        rel: "canonical",
        href: "https://tools.example.test/zh/tools/translate",
      },
      {
        rel: "alternate",
        hreflang: "zh-CN",
        href: "https://tools.example.test/zh/tools/translate",
      },
      {
        rel: "alternate",
        hreflang: "en",
        href: "https://tools.example.test/en/tools/translate",
      },
    ]);
  });

  it("only activates analytics configuration in production HTTPS environments", () => {
    const analytics = {
      gaMeasurementId: "G-TEST123456",
      umamiWebsiteId: "12345678-1234-1234-1234-123456789abc",
      umamiScriptUrl: "https://cloud.umami.is/script.js",
    };

    // Local / development: analytics must be disabled
    const localEnv = websiteEnvironment("http://127.0.0.1:4317", true, analytics);
    expect(localEnv.analytics).toBeUndefined();

    const devEnv = websiteEnvironment("https://preview.example.test", false, analytics);
    expect(devEnv.analytics).toBeUndefined();

    // Production HTTPS: analytics is active
    const prodEnv = websiteEnvironment("https://tools.example.test", true, analytics);
    expect(prodEnv.analytics).toEqual(analytics);
  });
});
