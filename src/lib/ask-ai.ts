import { site } from "@/site";
import type { Locale } from "@/i18n/core";

export interface AiPlatform {
  id: "chatgpt" | "claude" | "perplexity" | "gemini" | "grok";
  name: string;
  color?: string;
  getUrl: (prompt: string) => string;
}

export function buildAskAiPrompt(
  siteName: string = site.name,
  siteDescription: string = site.description,
  locale: Locale = "zh",
): string {
  if (locale === "zh") {
    return siteDescription
      ? `介绍一下 ${siteName}（${siteDescription}）是什么？它有哪些核心功能和特色？`
      : `介绍一下 ${siteName} 是什么？它有哪些核心功能和特色？`;
  }
  return siteDescription
    ? `What is ${siteName} (${siteDescription})? What are its key features and capabilities?`
    : `What is ${siteName} AI? What are its key features and capabilities?`;
}

export function getAskAiPlatforms(): AiPlatform[] {
  return [
    {
      id: "chatgpt",
      name: "ChatGPT",
      color: "currentColor",
      getUrl: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
    },
    {
      id: "claude",
      name: "Claude",
      color: "#D97757",
      getUrl: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
    },
    {
      id: "perplexity",
      name: "Perplexity",
      color: "#20B8CD",
      getUrl: (prompt) => `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
    },
    {
      id: "gemini",
      name: "Google Gemini",
      color: "#4E85DE",
      getUrl: (prompt) => `https://www.google.com/search?udm=50&q=${encodeURIComponent(prompt)}`,
    },
    {
      id: "grok",
      name: "Grok",
      color: "currentColor",
      getUrl: (prompt) => `https://grok.com/?q=${encodeURIComponent(prompt)}`,
    },
  ];
}
