import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { useResource } from "@/lib/use-resource";
import { Loading, Notice } from "@/components/ui/feedback";
import {
  Activity,
  Send,
  Mail,
  CreditCard,
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Bot,
} from "lucide-react";
import type { DiagnosticsReport } from "../types";

export function AdminDiagnostics() {
  const { t: tr } = useI18n();
  const { data, loading, error, reload } = useResource<DiagnosticsReport>(
    "/api/app/admin/diagnostics",
    true,
  );

  const [feishuTesting, setFeishuTesting] = useState(false);
  const [feishuResult, setFeishuResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [emailTesting, setEmailTesting] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleFeishuTest() {
    setFeishuTesting(true);
    setFeishuResult(null);
    try {
      const res = await fetch("/api/app/admin/diagnostics/feishu-test", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(json.message || "测试卡片发送失败");
      }
      setFeishuResult({ ok: true, message: json.message || tr("测试卡片已成功发送！") });
    } catch (err) {
      setFeishuResult({ ok: false, message: (err as Error).message });
    } finally {
      setFeishuTesting(false);
    }
  }

  async function handleEmailTest() {
    setEmailTesting(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/app/admin/diagnostics/email-test", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(json.message || "测试邮件发送失败");
      }
      setEmailResult({ ok: true, message: json.message || tr("测试邮件发送成功！") });
    } catch (err) {
      setEmailResult({ ok: false, message: (err as Error).message });
    } finally {
      setEmailTesting(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  return (
    <>
      <PageHeading
        title={tr("服务诊断")}
        description={tr("一览各外部服务、支付渠道与存储状态，提供即时连通性测试。")}
        action={
          <Button variant="secondary" onClick={() => void reload()} disabled={loading}>
            {tr("刷新诊断")}
          </Button>
        }
      />

      {error && <Notice kind="error">{tr(error)}</Notice>}

      {loading ? (
        <Loading />
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "16px" }}>
          {/* 1. 飞书机器人通知 */}
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px 0" }}>
                  <Send size={20} color="#3b82f6" />
                  {tr("飞书到账通知机器人")}
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: data.feishu.configured ? "rgba(16, 185, 129, 0.2)" : "rgba(107, 114, 128, 0.2)",
                      color: data.feishu.configured ? "#34d399" : "#9ca3af",
                      fontWeight: 600,
                    }}
                  >
                    {data.feishu.configured ? tr("已配置") : tr("未配置")}
                  </span>
                </h2>
                <p className="admin-secondary" style={{ margin: 0 }}>
                  {tr("每当有新订单支付入账后，自动向飞书群推送绿色标题交互式卡片通知。")}
                </p>
              </div>

              <Button
                variant="primary"
                onClick={handleFeishuTest}
                disabled={feishuTesting || !data.feishu.configured}
              >
                <Send size={16} />
                {feishuTesting ? tr("正在投递...") : tr("发送测试卡片到群")}
              </Button>
            </div>

            <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span className="admin-secondary">{tr("Webhook 地址")}</span>
                <p style={{ margin: "4px 0 0 0", fontFamily: "monospace", fontSize: "0.875rem" }}>
                  {data.feishu.webhookUrlMasked || tr("未填写")}
                </p>
              </div>
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span className="admin-secondary">{tr("安全签名 (HMAC-SHA256)")}</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>
                  {data.feishu.hasSecret ? tr("🔒 已启用安全签名") : tr("⚠️ 未配置签名密钥（免签）")}
                </p>
              </div>
            </div>

            {feishuResult && (
              <div style={{ marginTop: "12px" }}>
                <Notice kind={feishuResult.ok ? "info" : "error"}>{feishuResult.message}</Notice>
              </div>
            )}
          </section>

          {/* 2. 事务性邮件 (Resend) */}
          <section className="admin-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px 0" }}>
                  <Mail size={20} color="#10b981" />
                  {tr("邮件服务 (Resend)")}
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: data.email.configured ? "rgba(16, 185, 129, 0.2)" : "rgba(107, 114, 128, 0.2)",
                      color: data.email.configured ? "#34d399" : "#9ca3af",
                      fontWeight: 600,
                    }}
                  >
                    {data.email.configured ? tr("已配置") : tr("未配置")}
                  </span>
                </h2>
                <p className="admin-secondary" style={{ margin: 0 }}>
                  {tr("用于用户注册邮箱验证、找回密码与重要系统事务通知。")}
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={handleEmailTest}
                disabled={emailTesting || !data.email.configured}
              >
                <Mail size={16} />
                {emailTesting ? tr("正在发送...") : tr("向管理员发送测试邮件")}
              </Button>
            </div>

            <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span className="admin-secondary">{tr("发件人邮箱 (EMAIL_FROM)")}</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>
                  {data.email.emailFrom || tr("未设置")}
                </p>
              </div>
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span className="admin-secondary">{tr("API Key 状态")}</span>
                <p style={{ margin: "4px 0 0 0", fontFamily: "monospace", fontSize: "0.875rem" }}>
                  {data.email.apiKeyMasked || tr("未设置")}
                </p>
              </div>
            </div>

            {emailResult && (
              <div style={{ marginTop: "12px" }}>
                <Notice kind={emailResult.ok ? "info" : "error"}>{emailResult.message}</Notice>
              </div>
            )}
          </section>

          {/* 3. 商业支付通道 */}
          <section className="admin-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px 0" }}>
              <CreditCard size={20} color="#f59e0b" />
              {tr("出海商业支付渠道")}
              <small className="admin-secondary" style={{ fontSize: "0.875rem", fontWeight: "normal" }}>
                ({tr("当前默认通道")}: <strong>{data.payments.activeProvider}</strong>)
              </small>
            </h2>
            <p className="admin-secondary" style={{ margin: "0 0 12px 0" }}>
              {tr("通过 PAYMENT_PROVIDER 环境变量自由切换，支持无缝热备与历史订单自动对账。")}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              {[
                { id: "pancake", name: "Waffo Pancake (默认 MoR)", ready: data.payments.pancake },
                { id: "stripe", name: "Stripe (信用卡订阅)", ready: data.payments.stripe },
                { id: "creem", name: "Creem (轻量 MoR)", ready: data.payments.creem },
                { id: "paypal", name: "PayPal (电子钱包)", ready: data.payments.paypal },
              ].map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "14px",
                    background: "rgba(255, 255, 255, 0.03)",
                    borderRadius: "8px",
                    border: p.id === data.payments.activeProvider ? "1px solid var(--color-primary, #6366f1)" : "1px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{p.name}</strong>
                    {p.ready ? (
                      <CheckCircle2 size={16} color="#34d399" />
                    ) : (
                      <AlertCircle size={16} color="#9ca3af" />
                    )}
                  </div>
                  <small style={{ color: p.ready ? "#34d399" : "#9ca3af", marginTop: "4px", display: "block" }}>
                    {p.ready ? tr("凭据完整，可正常收款") : tr("未配置全部密钥")}
                  </small>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Google 登录与一键 One Tap */}
          <section className="admin-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px 0" }}>
              <ShieldCheck size={20} color="#8b5cf6" />
              {tr("谷歌一键登录 (Google OAuth & One Tap)")}
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: data.google.configured ? "rgba(16, 185, 129, 0.2)" : "rgba(107, 114, 128, 0.2)",
                  color: data.google.configured ? "#34d399" : "#9ca3af",
                  fontWeight: 600,
                }}
              >
                {data.google.configured ? tr("已就绪") : tr("未配置")}
              </span>
            </h2>
            <p className="admin-secondary" style={{ margin: "0 0 12px 0" }}>
              {tr("支持标准 Google OAuth 授权重定向，并已开启 FedCM / GIS 一键浮层快捷登录。")}
            </p>

            <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
              <span className="admin-secondary">{tr("Google Client ID")}</span>
              <p style={{ margin: "4px 0 0 0", fontFamily: "monospace", fontSize: "0.875rem" }}>
                {data.google.clientIdMasked || tr("未配置 (配置后自动激活全站 One Tap)")}
              </p>
            </div>
          </section>

          {/* 5. 存储与数据库 */}
          <section className="admin-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px 0" }}>
              <Database size={20} color="#06b6d4" />
              {tr("边缘数据库与对象存储")}
            </h2>
            <p className="admin-secondary" style={{ margin: "0 0 12px 0" }}>
              {tr("Cloudflare D1 边缘 SQLite 数据库与 Cloudflare R2 私有对象存储。")}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span className="admin-secondary">{tr("注册用户总数")}</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.25rem", fontWeight: 700 }}>
                  {data.storage.totalUsers.toLocaleString()} {tr("人")}
                </p>
              </div>
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span className="admin-secondary">{tr("R2 存储文件数")}</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.25rem", fontWeight: 700 }}>
                  {data.storage.totalFiles.toLocaleString()} {tr("个")}
                </p>
              </div>
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span className="admin-secondary">{tr("R2 已用存储空间")}</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.25rem", fontWeight: 700 }}>
                  {formatBytes(data.storage.totalStorageBytes)}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
