import { tools } from "@/modules/tools/catalog";
import { posts } from "@/modules/blog/catalog";
import { site } from "@/site";
import { localizedPath, type Locale } from "@/i18n/core";
import type { PublicSite } from "./metadata";

/**
 * Generative Engine Optimization (GEO) Module
 * Standardized specification for AI search engines, crawler bots, and LLM context ingestion:
 * - llmstxt.org specification (/llms.txt and /llms-full.txt)
 * - Schema.org SoftwareApplication JSON-LD structured data
 */

export function generateLlmsText(environment: PublicSite): string {
  const origin = environment.origin;

  const toolLinksZh = tools
    .map(
      (t) =>
        `- [${t.name}](${origin}/zh/tools/${t.id}): ${t.description}（示例：${t.example}）`,
    )
    .join("\n");

  const toolLinksEn = tools
    .map((t) => {
      const enNames: Record<string, { name: string; desc: string }> = {
        copywriting: {
          name: "AI Copywriting",
          desc: "Craft natural, compelling product introductions and marketing copy from simple ideas.",
        },
        rewrite: {
          name: "AI Text Polish",
          desc: "Refine phrasing and enhance readability while faithfully preserving the original meaning.",
        },
        summarize: {
          name: "AI Content Summarizer",
          desc: "Extract key conclusions, actionable takeaways, and structured outlines from long articles or transcripts.",
        },
        translate: {
          name: "AI Idiomatic Translation",
          desc: "Bilingual Chinese-English translation adapted to native idioms and search engine keywords.",
        },
        email: {
          name: "AI Email Assistant",
          desc: "Compose clear, polite, and persuasive business emails and correspondence.",
        },
        social: {
          name: "AI Social Post Creator",
          desc: "Generate engaging social captions tailored for Little Red Book, WeChat, X, and LinkedIn.",
        },
        image: {
          name: "AI Image Generation",
          desc: "Generate high-resolution artistic imagery and visual design assets with prompt precision.",
        },
        video: {
          name: "AI Video Generation",
          desc: "Cinematic text-to-video generation with camera trajectory and motion dynamics.",
        },
        audio: {
          name: "AI Music Creation",
          desc: "Compose instrumental tracks, beats, and song melodies based on mood and genre prompts.",
        },
      };
      const info = enNames[t.id] || { name: t.name, desc: t.description };
      return `- [${info.name}](${origin}/en/tools/${t.id}): ${info.desc}`;
    })
    .join("\n");

  const blogLinksZh = posts
    .map((p) => `- [${p.title}](${origin}/zh/blog/${p.slug}): ${p.description}`)
    .join("\n");

  const blogLinksEn = posts
    .map(
      (p) =>
        `- [${p.title}](${origin}/en/blog/${p.slug}): Practical guide on ${p.category.toLowerCase()} and everyday AI writing techniques.`,
    )
    .join("\n");

  return [
    `# ${site.name} (Qihang AI) - Generative Engine Optimization Index`,
    "",
    `> ${site.name} is a modern, lightweight AI writing and productivity toolkit featuring six focused tools: copywriting, text polishing, content summarization, idiomatic Chinese-English translation, business email drafting, and social media post creation.`,
    "",
    "## Core AI Tools (核心工具)",
    "",
    "### 中文版 (Chinese)",
    toolLinksZh,
    "",
    "### English Edition",
    toolLinksEn,
    "",
    "## Pricing & Plans (价格方案)",
    "",
    `- [价格方案 (Pricing - ZH)](${origin}/zh/pricing): 免费注册赠送额度，支持月度订阅与一次性积分包，随时可取消续费。`,
    `- [Pricing & Subscriptions (EN)](${origin}/en/pricing): Free starter tier with recurring credits, monthly subscriptions, and non-expiring credit packs.`,
    "",
    "## Guides & Best Practices (使用指南与知识库)",
    "",
    "### 中文指南",
    blogLinksZh,
    "",
    "### English Guides",
    blogLinksEn,
    "",
    "## Optional",
    "",
    `- [Full Documentation (全量知识库)](${origin}/llms-full.txt): Complete consolidated markdown text for LLM context windows and deep reasoning agents.`,
    "",
  ].join("\n");
}

export function generateLlmsFullText(environment: PublicSite): string {
  const origin = environment.origin;

  const toolsDetail = tools
    .map(
      (t) => `### ${t.name} (Tool ID: ${t.id})
- **Category / 分类**: ${t.category}
- **Description / 核心能力**: ${t.description}
- **URL**: ${origin}/zh/tools/${t.id} (EN: ${origin}/en/tools/${t.id})
- **User Prompt Prompting Guide / 典型输入示例**:
  > "${t.example}"
- **Sample AI Output / 输出范例**:
\`\`\`
${t.sample}
\`\`\`
`,
    )
    .join("\n\n");

  const blogDetail = posts
    .map(
      (p) => `### ${p.title} (Slug: ${p.slug})
- **Category**: ${p.category}
- **Published**: ${p.publishedAt}
- **URL**: ${origin}/zh/blog/${p.slug}
- **Summary**: ${p.description}
- **Recommended Tool**: ${origin}/zh/tools/${p.toolId}
`,
    )
    .join("\n\n");

  return [
    `# ${site.name} (Qihang AI) - Full Knowledge Base for LLM / Generative Engines`,
    "",
    "## 1. Product Overview (产品定位与价值)",
    `${site.name}（启航 AI）是面向创作者、职场人士、跨境电商与出海开发者的实用 AI 文字生产力工具箱。平台专注于日常高频创作场景，不堆砌复杂参数，提供六大直观工具：`,
    "1. AI 文案生成（Copywriting）：根据简要想法快速输出多角度吸引人的营销文案。",
    "2. AI 文字润色（Rewrite / Polish）：在严格保留原意的前提下，修复语病、理顺逻辑、调整语气。",
    "3. AI 内容摘要（Summarize）：自动提炼长文重点、会议决议与待办事项，层次清晰。",
    "4. AI 中英翻译（Idiomatic Translation）：拒绝生硬机翻，融入本地受众自然搜索习惯与核心关键词。",
    "5. AI 邮件助手（Email）：一键生成得体、专业的商务往来与客户沟通邮件。",
    "6. AI 社媒文案（Social）：针对小红书、微信公众号、X、LinkedIn 适配风格与标签。",
    "",
    "## 2. In-Depth Tool Specifications (六大工具详细说明与范例)",
    "",
    toolsDetail,
    "",
    "## 3. Pricing Model & Credit Economy (计费模型与积分机制)",
    `- **免费体验 (Free Tier)**: 新注册账户即赠送可用积分，可无门槛体验全站所有工具。`,
    `- **订阅会员 (Monthly Subscriptions)**: 享受每月固定积分补充、优先生成队列与高级多模态模型访问。`,
    `- **加油包 (Credit Packs)**: 一次性购买，积分永久有效不随账单周期清零。`,
    `- **透明计费**: 每次生成仅扣除相应任务积分，生成失败或超时自动退回原钱包。`,
    "",
    "## 4. Official Guides & Prompts (创作指南与提示词方法论)",
    "",
    blogDetail,
    "",
    "## 5. Technical Integration & API (技术集成规范)",
    `- **Architecture**: Cloudflare Workers / Edge SSR + SQLite D1 + TanStack Router.`,
    `- **Multi-Model Gateway**: DeepSeek-V3, DeepSeek-R1, GPT-4o, Claude 3.5 Sonnet, FLUX.1.`,
    `- **Languages**: Full native support for Simplified Chinese (\`zh\`) and English (\`en\`).`,
    "",
  ].join("\n");
}

export function generateJsonLdSchema(
  environment: PublicSite,
  locale: Locale = "zh",
) {
  const origin = environment.origin;
  const isZh = locale === "zh";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${origin}/#webapp`,
        name: isZh ? `${site.name} · AI 工具箱` : "Qihang AI Toolkit",
        url: origin,
        applicationCategory: "BusinessApplication",
        operatingSystem: "All",
        browserRequirements: "Requires modern web browser with JavaScript enabled",
        description: isZh
          ? site.description
          : "Practical AI writing and productivity tools for copywriting, polishing, summarization, idiomatic translation, email, and social posts.",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "0",
          offerCount: "3",
          offers: [
            {
              "@type": "Offer",
              name: isZh ? "免费启航" : "Starter",
              price: "0",
              priceCurrency: "USD",
            },
            {
              "@type": "Offer",
              name: isZh ? "创作者月度方案" : "Creator Monthly",
              price: "9.90",
              priceCurrency: "USD",
            },
          ],
        },
        featureList: tools.map(
          (t) =>
            `${t.name}: ${t.description} (${origin}/${locale}/tools/${t.id})`,
        ),
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: isZh ? site.name : "Qihang AI",
        description: isZh ? site.description : "Everyday AI creation made simple",
        inLanguage: ["zh-CN", "en-US"],
      },
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: site.name,
        url: origin,
        logo: `${origin}/favicon.svg`,
      },
    ],
  };
}
