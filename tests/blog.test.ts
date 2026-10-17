import { describe, it, expect } from "vitest";
import { posts, getPost } from "../src/modules/blog/catalog";
import { articleHead } from "../src/modules/blog/seo";
import { getTool } from "../src/modules/tools/catalog";
describe("blog publishing boundaries", () => {
  it("rejects unknown slugs and keeps links and publication metadata valid", () => {
    expect(getPost("constructor")).toBeUndefined();
    expect(getPost("not-published")).toBeUndefined();
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    for (const post of posts) {
      expect(getTool(post.toolId)).toBeDefined();
      expect(post.slug).toMatch(/^[a-z0-9-]+$/);
      expect(Number.isNaN(Date.parse(post.publishedAt))).toBe(false);
      expect(Date.parse(post.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(post.publishedAt),
      );
    }
  });
  it("emits article metadata with the production origin and safe JSON-LD", () => {
    const head = articleHead(posts[0], {
      origin: "https://tools.example.test",
      indexable: true,
    });
    const structured = JSON.parse(head.scripts[0].children);
    expect(structured["@type"]).toBe("BlogPosting");
    expect(structured.mainEntityOfPage).toBe(
      "https://tools.example.test/zh/blog/write-better-ai-prompts",
    );
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: structured.mainEntityOfPage,
    });
    expect(head.links).toHaveLength(3);
    expect(head.meta).toContainEqual({
      property: "og:type",
      content: "article",
    });
    const malicious = articleHead(
      {
        ...posts[0],
        title: "</script><script>alert(1)</script>",
      } as unknown as (typeof posts)[0],
      { origin: "http://localhost", indexable: false },
    );
    expect(malicious.links).toEqual([]);
    expect(malicious.scripts[0].children).not.toContain("<");
    expect(JSON.parse(malicious.scripts[0].children).headline).toContain(
      "</script>",
    );
  });
});
