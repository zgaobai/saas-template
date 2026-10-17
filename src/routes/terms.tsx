import { useI18n } from "@/i18n/react";
import { pageHead } from "@/modules/seo/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import { site } from "@/site";
export const Route = createFileRoute("/terms")({
  head: ({ match }) =>
    pageHead(
      {
        title: `使用条款 · ${site.name}`,
        description: "了解 AI 内容使用、计费与退款说明。当前为开发草稿。",
        path: "/terms",
      },
      match.context.publicSite,
    ),
  component: () => {
    const { t: tr, locale } = useI18n();
    return (
      <PublicLayout className="container legal">
        <h1>{tr("使用条款（开发草稿）")}</h1>
        <p>
          {tr(
            "此页面用于模板开发验证，不能作为已完成的正式服务条款。上线前需补充运营主体、联系方式、退款政策与适用条款。",
          )}
        </p>
        <h2>{tr("创作与核实")}</h2>
        <p>
          {tr(
            "AI 生成内容可能不准确。使用者应核实事实，并确保拥有输入素材的使用权。",
          )}
        </p>
        <h2>{tr("计费说明")}</h2>
        <p>
          {tr(
            "当前演示方案以美元计价。订阅按月续费；积分包为一次性购买。支付成功以服务端确认结果为准。退款会撤回相应积分。",
          )}
        </p>
      </PublicLayout>
    );
  },
});
