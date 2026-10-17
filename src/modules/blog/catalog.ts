import { site } from "@/site";
export const posts = [
  {
    slug: "write-better-ai-prompts",
    title: "AI 提示词怎么写？把需求说明白的四个要点",
    description:
      "从目标、背景、限制和输出格式入手，把模糊的写作需求整理成可直接使用的提示词。",
    category: "提示词",
    publishedAt: "2026-10-16",
    updatedAt: "2026-10-16",
    author: site.name,
    toolId: "copywriting",
    toolLabel: "试试 AI 文案生成",
  },
  {
    slug: "rewrite-without-changing-meaning",
    title: "用 AI 润色文章，怎样保留原意？",
    description:
      "先标出不能改变的事实，再调整结构与语气，用一套简单的核对方法检查 AI 润色结果。",
    category: "写作方法",
    publishedAt: "2026-10-16",
    updatedAt: "2026-10-16",
    author: site.name,
    toolId: "rewrite",
    toolLabel: "试试 AI 文字润色",
  },
  {
    slug: "summarize-long-text",
    title: "长文怎么提炼重点？用 AI 做一份能核对的摘要",
    description:
      "按阅读目的整理长文，区分结论、证据与待确认信息，避免把摘要当成原文的全部内容。",
    category: "效率办公",
    publishedAt: "2026-10-16",
    updatedAt: "2026-10-16",
    author: site.name,
    toolId: "summarize",
    toolLabel: "试试 AI 内容摘要",
  },
] as const;
export type BlogPost = (typeof posts)[number];
export const getPost = (slug: string) =>
  posts.find((post) => post.slug === slug);
