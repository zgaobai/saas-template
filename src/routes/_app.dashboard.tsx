import { useI18n } from "@/i18n/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { tools } from "@/modules/tools/catalog";
import { ToolCard } from "@/modules/tools/components/tool-card";
import { PageHeading } from "@/components/layout/page-heading";
import { useResource } from "@/lib/use-resource";
import type { Overview } from "@/modules/tools/types";
import { Notice } from "@/components/ui/feedback";
export const Route = createFileRoute("/_app/dashboard")({
  component: Page,
});
function Page() {
  const { t: tr, locale } = useI18n();
  const { user } = Route.useRouteContext();
  const { data, error } = useResource<Overview>("/api/app/overview");
  return (
    <>
      <PageHeading
        title={tr("{0}，今天想完成什么？", [user.name])}
        description={tr("选一个工具开始，或回到之前的创作。")}
        action={
          <Link to="/history" className="button button-secondary">
            {tr("查看创作记录")}
          </Link>
        }
      />
      {error && <Notice kind="error">{tr(error)}</Notice>}
      <div className="balance-banner">
        <div>
          <span>{tr("可用积分")}</span>
          <strong>{data?.balance ?? "—"}</strong>
          <p>{tr("每次成功生成消耗 1 积分")}</p>
        </div>
        <Link to="/billing" className="text-link">
          {tr("积分与账单")}
        </Link>
      </div>
      <h2 className="block-title">{tr("开始一次新创作")}</h2>
      <div className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} showDetails={false} />
        ))}
      </div>
    </>
  );
}
