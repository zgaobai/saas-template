import PromptArticle from "./posts/write-better-ai-prompts";
import RewriteArticle from "./posts/rewrite-without-changing-meaning";
import SummaryArticle from "./posts/summarize-long-text";
import type { BlogPost } from "./catalog";
const bodies = {
  "write-better-ai-prompts": PromptArticle,
  "rewrite-without-changing-meaning": RewriteArticle,
  "summarize-long-text": SummaryArticle,
} satisfies Record<BlogPost["slug"], () => React.JSX.Element>;
export function ArticleBody({ slug }: { slug: BlogPost["slug"] }) {
  const Body = bodies[slug];
  return <Body />;
}
