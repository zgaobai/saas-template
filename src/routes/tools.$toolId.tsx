import { useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { pageHead } from "@/modules/seo/metadata";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { capabilities, sessionInfo } from "@/modules/auth/functions";
import { getTool } from "@/modules/tools/catalog";
import { ToolWorkbench } from "@/modules/tools/components/tool-workbench";
import { site } from "@/site";
export const Route = createFileRoute("/tools/$toolId")({
  loader: async ({ params }) => {
    const tool = getTool(params.toolId);
    if (!tool) throw notFound();
    const [caps, user] = await Promise.all([capabilities(), sessionInfo()]);
    return {
      tool,
      caps,
      user,
    };
  },
  head: ({ loaderData, match, params }) =>
    loaderData
      ? pageHead(
          {
            title: `${loaderData.tool.name} · ${site.name}`,
            description: loaderData.tool.description,
            path: `/tools/${params.toolId}`,
          },
          match.context.publicSite,
        )
      : {
          meta: [
            {
              name: "robots",
              content: "noindex,nofollow",
            },
          ],
        },
  component: Page,
});
function Page() {
  const { t: tr, locale } = useI18n();
  const { tool, caps, user } = Route.useLoaderData();
  return (
    <PublicLayout className="container tool-page">
      <HomeSectionLink section="tools" className="back-link tool-back">
        <ArrowLeft size={15} />
        {tr("全部工具")}
      </HomeSectionLink>
      <ToolWorkbench
        key={tool.id}
        tool={tool}
        aiReady={caps.ai}
        signedIn={!!user}
      />
    </PublicLayout>
  );
}
