import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  resolveLocale,
  createTranslator,
  translate,
  localizedPath,
  localeFromRequest,
} from "@/i18n/core";
import en from "@/i18n/en.json";
import { tools, categories } from "@/modules/tools/catalog";
import { posts } from "@/modules/blog/catalog";
import { pageHead, sitemapXml } from "@/modules/seo/metadata";
import { articleHead } from "@/modules/blog/seo";
import { generationInput } from "@/modules/tools/input";
import { formatDateTime } from "@/lib/date";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { systemPrompt } from "@/modules/tools/server/prompts";

describe("language selection and request isolation", () => {
  it("prefers explicit language, then cookie, then weighted browser preferences", () => {
    expect(resolveLocale("en", "zh", "zh-CN")).toBe("en");
    expect(resolveLocale(undefined, "zh", "en-US")).toBe("zh");
    expect(resolveLocale(undefined, undefined, "en;q=0.5,zh-CN;q=0.9")).toBe(
      "zh",
    );
    expect(resolveLocale(undefined, undefined, "en;q=0,zh;q=0.1")).toBe("zh");
    expect(resolveLocale("invalid", "malicious", "fr-FR")).toBe("en");
  });
  it("isolates translators and language cookies across concurrent requests", async () => {
    const values = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(createTranslator(i % 2 ? "zh" : "en")("登录")),
      ),
    );
    expect(values.every((v, i) => v === (i % 2 ? "登录" : "Sign in"))).toBe(
      true,
    );
    expect(
      localeFromRequest(
        new Request("https://example.test", {
          headers: {
            cookie: "other=en; qihang-locale=zh",
            "accept-language": "en",
          },
        }),
      ),
    ).toBe("zh");
  });
  it("supports interpolation, translated provider errors and unchanged unknown content", () => {
    expect(translate("en", "第 {0} 页 · 每页 25 条", [3])).toBe(
      "Page 3 · 25 per page",
    );
    expect(translate("zh", "第 {0} 页 · 每页 25 条", [3])).toBe(
      "第 3 页 · 每页 25 条",
    );
    expect(translate("en", "已发放 40 积分")).toBe("Granted 40 credits");
    expect(translate("en", "unknown {0}")).toBe("unknown {0}");
    expect(translate("en", "用户自己的内容 <script>")).toBe(
      "用户自己的内容 <script>",
    );
    expect(createTranslator("en")(undefined)).toBeUndefined();
  });
});
describe("translation coverage and content boundaries", () => {
  it("covers authored UI messages and keeps placeholders intact", () => {
    const dictionary = en as Record<string, string>;
    function scan(dir: string) {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) scan(p);
        else if (/\.tsx$/.test(p)) {
          for (const match of readFileSync(p, "utf8").matchAll(
            /\btr\(\s*("(?:[^"\\]|\\.)*")/g,
          )) {
            const source = JSON.parse(match[1]);
            if (/[\u4e00-\u9fff]/.test(source))
              expect(dictionary[source], p + ": " + source).toBeTruthy();
          }
        }
      }
    }
    scan("src");
    for (const [source, target] of Object.entries(dictionary)) {
      const slots = (s: string) =>
        [...new Set(s.match(/\{\d+\}/g) ?? [])].sort();
      expect(slots(target), source).toEqual(slots(source));
    }
  });
  it("covers tool and blog catalog text without changing business identifiers", () => {
    const tr = createTranslator("en");
    for (const tool of tools) {
      for (const field of [
        tool.name,
        tool.description,
        tool.label,
        tool.placeholder,
        tool.example,
        tool.sample,
      ]) {
        if (/[\u4e00-\u9fff]/.test(field))
          expect(tr(field)).not.toMatch(/[\u4e00-\u9fff]/);
      }
    }
    for (const c of categories) expect(tr(c)).not.toMatch(/[\u4e00-\u9fff]/);
    for (const post of posts) {
      expect(tr(post.title)).not.toMatch(/[\u4e00-\u9fff]/);
      expect(tr(post.description)).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(Object.keys(en).join(" ")).not.toContain("SELECT");
    expect(Object.keys(en).join(" ")).not.toContain("你是实用的文字处理助手");
  });
  it("accepts only known generation languages and preserves tone values", () => {
    const input = {
      requestId: crypto.randomUUID(),
      toolId: "copywriting",
      prompt: "Some product description",
      tone: "自然清晰",
    };
    expect(generationInput.parse(input).locale).toBe("zh");
    expect(generationInput.parse({ ...input, locale: "en" }).tone).toBe(
      "自然清晰",
    );
    expect(
      generationInput.safeParse({ ...input, locale: "script" }).success,
    ).toBe(false);
    expect(systemPrompt("copywriting", "自然清晰", "en")).toContain(
      "English copy",
    );
    expect(systemPrompt("rewrite", "自然清晰", "en")).toContain(
      "original language",
    );
    expect(systemPrompt("translate", "自然清晰", "en")).toContain(
      "Chinese to English or English to Chinese",
    );
    expect(systemPrompt("translate", "自然清晰", "en")).toContain(
      "search habits",
    );
    expect(systemPrompt("translate", "自然清晰", "zh")).toContain(
      "本地搜索习惯",
    );
    expect(systemPrompt("translate", "自然清晰", "zh")).toContain(
      "严禁生硬机翻",
    );
  });
});
describe("localized dates and public metadata", () => {
  it("formats language-specific dates in the same documented timezone", () => {
    const time = Date.UTC(2026, 9, 16, 0, 8, 38);
    expect(formatDateTime(time, "en")).toBe("16/10/2026 08:08:38");
    expect(formatDateTime(time, "zh")).toContain("2026/10/16");
  });
  it("emits distinct canonical URLs, alternate languages and localized article metadata", () => {
    expect(localizedPath("/pricing?auth=login", "en")).toBe(
      "/en/pricing?auth=login",
    );
    const environment = {
      origin: "https://tools.example.test",
      indexable: true,
      locale: "en" as const,
    };
    const head = pageHead(
      {
        title: "价格方案 · 启航 AI",
        description: "账户中心",
        path: "/pricing",
      },
      environment,
    );
    expect(head.meta).toContainEqual({ title: "Pricing · Qihang AI" });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://tools.example.test/en/pricing",
    });
    expect(
      head.links.some((l) => "hreflang" in l && l.hreflang === "zh-CN"),
    ).toBe(true);
    const article = JSON.parse(
      articleHead(posts[0], environment).scripts[0].children,
    );
    expect(article.inLanguage).toBe("en");
    expect(article.headline).not.toMatch(/[\u4e00-\u9fff]/);
    expect(sitemapXml(environment)).toContain("/zh/");
    expect(sitemapXml(environment)).toContain("/en/");
    expect(
      pageHead(
        { title: "登录", description: "登录", path: "/login" },
        { ...environment, indexable: false },
      ).links,
    ).toEqual([]);
  });
});
