import { useI18n } from "@/i18n/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { CheckCircle2 } from "lucide-react";
import { authClient } from "@/modules/auth/client";
import { Link } from "@tanstack/react-router";

export function FeedbackForm({
  onSuccess,
  onCancel,
  showCancel = true,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}) {
  const { t: tr } = useI18n();
  const { data: session } = authClient.useSession();
  const [type, setType] = useState<"suggestion" | "bug" | "billing" | "other">(
    "suggestion",
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (session?.user?.email && !contact) {
      setContact(session.user.email);
    }
  }, [session?.user?.email]);

  function resetForm() {
    setType("suggestion");
    setTitle("");
    setContent("");
    setContact(session?.user?.email || "");
    setError("");
    setSubmitted(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/app/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, content, contact }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        throw new Error(json.message || "提交失败，请稍后重试");
      }
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <CheckCircle2
          size={48}
          color="#10b981"
          style={{ margin: "0 auto 12px" }}
        />
        <h3 style={{ fontSize: "1.15rem", margin: "0 0 8px" }}>
          {tr("反馈已送达，非常感谢！")}
        </h3>
        <p
          className="admin-secondary"
          style={{ fontSize: "0.875rem", margin: "0 0 20px" }}
        >
          {tr("你的宝贵意见将直接送达团队，并在后续版本迭代中持续优化。")}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Button variant="secondary" onClick={resetForm}>
            {tr("提交另一条反馈")}
          </Button>
          {onSuccess ? (
            <Button variant="primary" onClick={onSuccess}>
              {tr("完成")}
            </Button>
          ) : (
            <Link to="/" className="button button-primary">
              {tr("返回首页")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      {error && <Notice kind="error">{tr(error)}</Notice>}

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {tr("反馈类型")}
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
          }}
        >
          {[
            { id: "suggestion", label: tr("功能建议") },
            { id: "bug", label: tr("问题缺陷") },
            { id: "billing", label: tr("支付账单") },
            { id: "other", label: tr("其它咨询") },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setType(item.id as any)}
              style={{
                padding: "8px 4px",
                borderRadius: "6px",
                fontSize: "0.8rem",
                border:
                  type === item.id
                    ? "1px solid var(--color-primary, #6366f1)"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                background:
                  type === item.id
                    ? "rgba(99, 102, 241, 0.15)"
                    : "transparent",
                color:
                  type === item.id ? "var(--color-primary, #6366f1)" : "inherit",
                fontWeight: type === item.id ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {tr("标题概要")} *
        </label>
        <input
          type="text"
          required
          className="input full-width"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tr("简述你的建议或遇到的问题...")}
        />
      </div>

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {tr("详细描述")} *
        </label>
        <textarea
          required
          rows={4}
          className="input full-width"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={tr("请详细说明你的诉求、操作步骤或期望效果...")}
        />
      </div>

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {tr("联系方式 (选填)")}
        </label>
        <input
          type="text"
          className="input full-width"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={tr(
            "留下你的邮箱、微信或 Telegram，方便我们答复处理结果",
          )}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
          marginTop: "8px",
        }}
      >
        {showCancel && onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {tr("取消")}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? tr("提交中...") : tr("确认提交")}
        </Button>
      </div>
    </form>
  );
}
