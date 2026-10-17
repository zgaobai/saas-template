import { useI18n } from "@/i18n/react";
import { pageHead } from "@/modules/seo/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import { site } from "@/site";
export const Route = createFileRoute("/privacy")({
  head: ({ match }) =>
    pageHead(
      {
        title: `隐私说明 · ${site.name}`,
        description:
          "了解模板处理的账户、创作、文件与支付相关数据。当前为开发草稿。",
        path: "/privacy",
      },
      match.context.publicSite,
    ),
  component: () => {
    const { t: tr, locale } = useI18n();
    return (
      <PublicLayout className="container legal">
        <h1>{tr("隐私说明（开发草稿）")}</h1>
        <p>
          {tr(
            "这是模板演示页面。正式上线前，运营者需要补充实际主体、联系方式、保留期限和适用政策。",
          )}
        </p>
        <h2>{tr("本模板处理的数据")}</h2>
        <p>
          {tr(
            "账户信息、登录会话、订单、积分流水、创作输入与结果，以及你上传的文件。生成请求会发送到运营者配置的 AI 服务；支付由相应支付服务处理。",
          )}
        </p>
        <h2>{tr("访问与处理")}</h2>
        <p>
          {tr(
            "个人文件和记录仅通过身份验证后访问。可在账户设置中注销账户。注销前需自行保存内容并删除个人文件；注销后账户资料匿名化、创作记录删除，账务和审计记录保留。实际保留期限与联系渠道由运营者在上线前补充。",
          )}
        </p>
      </PublicLayout>
    );
  },
});
