import { describe, it, expect } from "vitest";
import {
  generateLlmsText,
  generateLlmsFullText,
  generateJsonLdSchema,
} from "@/modules/seo/geo";
import { websiteEnvironment, robotsText } from "@/modules/seo/metadata";
import { tools } from "@/modules/tools/catalog";
import { posts } from "@/modules/blog/catalog";

describe("Generative Engine Optimization (GEO)", () => {
  const env = websiteEnvironment("https://saas.example.com", true);

  it("generates standardized /llms.txt adhering to the llmstxt.org specification", () => {
    const text = generateLlmsText(env);

    // Standard markdown structure
    expect(text.startsWith("# ")).toBe(true);
    expect(text).toContain("> "); // Blockquote summary
    expect(text).toContain("## Core AI Tools");
    expect(text).toContain("## Pricing & Plans");
    expect(text).toContain("## Guides & Best Practices");
    expect(text).toContain("## Optional");

    // All tools must be linked with description and origin
    for (const tool of tools) {
      expect(text).toContain(`https://saas.example.com/zh/tools/${tool.id}`);
      expect(text).toContain(`https://saas.example.com/en/tools/${tool.id}`);
    }

    // Guides must be linked
    for (const post of posts) {
      expect(text).toContain(`https://saas.example.com/zh/blog/${post.slug}`);
    }

    // Must point to full knowledge dump
    expect(text).toContain("https://saas.example.com/llms-full.txt");
  });

  it("generates /llms-full.txt with deep context for reasoning models and agents", () => {
    const full = generateLlmsFullText(env);

    expect(full).toContain("## 1. Product Overview");
    expect(full).toContain("## 2. In-Depth Tool Specifications");
    expect(full).toContain("## 3. Pricing Model & Credit Economy");
    expect(full).toContain("## 4. Official Guides & Prompts");
    expect(full).toContain("## 5. Technical Integration & API");

    // Must include prompts and sample outputs for all 6 tools
    for (const tool of tools) {
      expect(full).toContain(tool.name);
      expect(full).toContain(tool.description);
      expect(full).toContain(tool.example);
      expect(full).toContain(tool.sample);
    }
  });

  it("produces valid Schema.org JSON-LD structured data for AI search citations", () => {
    const schemaZh = generateJsonLdSchema(env, "zh");
    expect(schemaZh["@context"]).toBe("https://schema.org");
    expect(Array.isArray(schemaZh["@graph"])).toBe(true);

    const webApp = schemaZh["@graph"].find(
      (item: any) => item["@type"] === "WebApplication",
    ) as any;
    expect(webApp).toBeDefined();
    expect(webApp.applicationCategory).toBe("BusinessApplication");
    expect(webApp.featureList.length).toBe(tools.length);
    expect(webApp.offers).toBeDefined();

    const website = schemaZh["@graph"].find(
      (item: any) => item["@type"] === "WebSite",
    ) as any;
    expect(website.url).toBe("https://saas.example.com");

    const schemaEn = generateJsonLdSchema(env, "en");
    const webAppEn = schemaEn["@graph"].find(
      (item: any) => item["@type"] === "WebApplication",
    ) as any;
    expect(webAppEn.name).toContain("Qihang AI Toolkit");
  });

  it("robots.txt explicitly welcomes AI search crawlers to llms.txt endpoints", () => {
    const robots = robotsText(env);
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("User-agent: PerplexityBot");
    expect(robots).toContain("User-agent: ClaudeBot");
    expect(robots).toContain("User-agent: Google-Extended");
    expect(robots).toContain("Allow: /llms.txt");
    expect(robots).toContain("Allow: /llms-full.txt");
    expect(robots).toContain("Sitemap: https://saas.example.com/sitemap.xml");
  });
});
