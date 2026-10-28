import { describe, it, expect } from "vitest";
import {
  websiteEnvironment,
  sitemapXml,
  robotsText,
  pageHead,
} from "../src/modules/seo/metadata";
import { buildAskAiPrompt, getAskAiPlatforms } from "../src/lib/ask-ai";
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

describe("GEO Ask AI URL builders", () => {
  it("builds localized ask prompts using project metadata", () => {
    const zhPrompt = buildAskAiPrompt("启航", "文案与翻译", "zh");
    expect(zhPrompt).toContain("启航");
    expect(zhPrompt).toContain("文案与翻译");

    const enPrompt = buildAskAiPrompt("Qihang", "AI Toolkit", "en");
    expect(enPrompt).toContain("Qihang");
    expect(enPrompt).toContain("AI Toolkit");
  });

  it("configures the 5 major AI platform query URLs", () => {
    const platforms = getAskAiPlatforms();
    expect(platforms).toHaveLength(5);
    const ids = platforms.map((p) => p.id);
    expect(ids).toEqual(["chatgpt", "claude", "perplexity", "gemini", "grok"]);

    const prompt = "What is Qihang AI?";
    const encoded = encodeURIComponent(prompt);

    const chatgpt = platforms.find((p) => p.id === "chatgpt");
    expect(chatgpt?.getUrl(prompt)).toBe(`https://chatgpt.com/?q=${encoded}`);

    const claude = platforms.find((p) => p.id === "claude");
    expect(claude?.getUrl(prompt)).toBe(`https://claude.ai/new?q=${encoded}`);

    const perplexity = platforms.find((p) => p.id === "perplexity");
    expect(perplexity?.getUrl(prompt)).toBe(`https://www.perplexity.ai/search?q=${encoded}`);

    const gemini = platforms.find((p) => p.id === "gemini");
    expect(gemini?.getUrl(prompt)).toBe(`https://www.google.com/search?udm=50&q=${encoded}`);

    const grok = platforms.find((p) => p.id === "grok");
    expect(grok?.getUrl(prompt)).toBe(`https://grok.com/?q=${encoded}`);
  });
});
