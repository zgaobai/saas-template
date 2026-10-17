import { createTranslator, localizedPath, localeTag } from "@/i18n/core";
import { pageHead, type PublicSite } from "@/modules/seo/metadata";
import type { BlogPost } from "./catalog";
export function articleHead(post: BlogPost, environment: PublicSite) {
  const tr = createTranslator(environment.locale ?? "zh");
  const path = `/blog/${post.slug}`;
  const url = new URL(
    localizedPath(path, environment.locale ?? "zh"),
    environment.origin,
  ).href;
  const head = pageHead(
    {
      title: `${tr(post.title)} · ${tr(post.author)}`,
      description: tr(post.description),
      path,
      type: "article",
    },
    environment,
  );
  return {
    ...head,
    meta: [
      ...head.meta,
      { property: "article:published_time", content: post.publishedAt },
      { property: "article:modified_time", content: post.updatedAt },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: tr(post.title),
          description: tr(post.description),
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          inLanguage: localeTag(environment.locale ?? "zh"),
          author: { "@type": "Organization", name: tr(post.author) },
          mainEntityOfPage: url,
        }).replace(/</g, "\\u003c"),
      },
    ],
  };
}
