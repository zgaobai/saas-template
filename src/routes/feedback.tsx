import { useI18n } from "@/i18n/react";
import { pageHead } from "@/modules/seo/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import { site } from "@/site";
import { FeedbackForm } from "@/modules/feedback/components/feedback-form";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/feedback")({
  head: ({ match }) =>
    pageHead(
      {
        title: `反馈与建议 · ${site.name}`,
        description:
          "无论是否登录，你都可以随时向我们提交功能建议、体验吐槽或问题缺陷。",
        path: "/feedback",
      },
      match.context.publicSite,
    ),
  component: () => {
    const { t: tr } = useI18n();

    return (
      <PublicLayout className="feedback-page">
        <div className="feedback-header" style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(99, 102, 241, 0.12)",
              color: "var(--color-primary, #6366f1)",
              marginBottom: "16px",
            }}
          >
            <MessageSquare size={24} />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 10px" }}>
            {tr("反馈与建议")}
          </h1>
          <p
            className="admin-secondary"
            style={{ fontSize: "0.95rem", maxWidth: "460px", margin: "0 auto", lineHeight: 1.6 }}
          >
            {tr(
              "无论是否登录，你都可以随时向我们提交功能建议、体验吐槽或问题缺陷。",
            )}
          </p>
        </div>

        <div className="feedback-card">
          <FeedbackForm showCancel={false} />
        </div>
      </PublicLayout>
    );
  },
});
