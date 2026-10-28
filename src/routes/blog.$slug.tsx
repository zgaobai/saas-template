import { useI18n } from "@/i18n/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { getPost, posts } from "@/modules/blog/catalog";
import { ArticleBody } from "@/modules/blog/article-body";
import { articleHead } from "@/modules/blog/seo";
export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData, match }) =>
    loaderData
      ? articleHead(loaderData, match.context.publicSite)
      : {
          meta: [
            {
              title: "文章未找到",
            },
            {
              name: "robots",
              content: "noindex,nofollow",
            },
          ],
        },
  notFoundComponent: () => {
    const { t: tr, locale } = useI18n();
    return (
      <PublicLayout className="container legal">
        <h1>{tr("这篇文章不存在")}</h1>
        <p>{tr("文章可能已移除，看看其他内容吧。")}</p>
        <Link to="/blog">{tr("返回博客")}</Link>
      </PublicLayout>
    );
  },
  component: Article,
});
function Article() {
  const { t: tr, locale } = useI18n();
  const post = Route.useLoaderData();
  return (
    <PublicLayout className="container blog-article">
      <Link to="/blog" className="blog-back">
        <ArrowLeft size={16} />
        {tr("全部文章")}
      </Link>
      <article>
        <header>
          <div className="blog-meta">
            <span>{tr(post.category)}</span>
            <time dateTime={post.publishedAt}>
              {post.publishedAt.replaceAll("-", ".")}
            </time>
            <span>{post.author}</span>
          </div>
          <h1>{tr(post.title)}</h1>
          <p className="blog-intro">{tr(post.description)}</p>
        </header>
        <div className="blog-prose">
          <ArticleBody slug={post.slug} />
        </div>
        <div className="blog-action">
          <p>{tr("把方法用到你的下一次创作。")}</p>
          <Link
            to="/tools/$toolId"
            params={{
              toolId: post.toolId,
            }}
            className="button button-primary"
          >
            {tr(post.toolLabel)}
          </Link>
        </div>
      </article>
      <aside className="blog-related" aria-label={tr("继续阅读")}>
        <h2>{tr("继续阅读")}</h2>
        {posts
          .filter((item) => item.slug !== post.slug)
          .map((item) => (
            <Link
              key={item.slug}
              to="/blog/$slug"
              params={{
                slug: item.slug,
              }}
            >
              {tr(item.title)}
            </Link>
          ))}
      </aside>
    </PublicLayout>
  );
}
