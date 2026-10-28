import { useI18n } from "@/i18n/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import { posts } from "@/modules/blog/catalog";
import { pageHead } from "@/modules/seo/metadata";
import { site } from "@/site";
export const Route = createFileRoute("/blog/")({
  head: ({ match }) =>
    pageHead(
      {
        title: `博客 · ${site.name}`,
        description:
          "分享 AI 提示词、文字创作与效率办公的方法，带着具体问题阅读，然后动手试试。",
        path: "/blog",
      },
      match.context.publicSite,
    ),
  component: () => {
    const { t: tr, locale } = useI18n();
    return (
      <PublicLayout className="container blog-index">
        <header className="blog-heading">
          <h1>{tr("博客")}</h1>
          <p>{tr("关于 AI、写作，以及把想法变成内容的方法。")}</p>
        </header>
        <div className="blog-list">
          {posts.map((post) => (
            <article className="blog-row" key={post.slug}>
              <div className="blog-meta">
                <span>{tr(post.category)}</span>
                <time dateTime={post.publishedAt}>
                  {post.publishedAt.replaceAll("-", ".")}
                </time>
              </div>
              <div>
                <h2>
                  <Link
                    to="/blog/$slug"
                    params={{
                      slug: post.slug,
                    }}
                  >
                    {tr(post.title)}
                  </Link>
                </h2>
                <p>{tr(post.description)}</p>
              </div>
            </article>
          ))}
        </div>
      </PublicLayout>
    );
  },
});
