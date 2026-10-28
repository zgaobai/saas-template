import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { useResource } from "@/lib/use-resource";
import { Loading, Notice } from "@/components/ui/feedback";
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
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
          {/* 1. 飞书机器人通知 */}
          <section className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{tr("飞书到账通知机器人")}</span>
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: data.feishu.configured ? "rgba(16, 185, 129, 0.12)" : "rgba(107, 114, 128, 0.12)",
                      color: data.feishu.configured ? "#10b981" : "var(--muted)",
                      fontWeight: 500,
                    }}
                  >
                    {data.feishu.configured ? tr("已配置") : tr("未配置")}
                  </span>
                </h3>
                <p className="admin-secondary" style={{ margin: 0, fontSize: "13px" }}>
                  {tr("每当有新订单支付入账后，自动向飞书群推送绿色标题交互式卡片通知。")}
                </p>
              </div>

              <Button
                variant="primary"
                onClick={handleFeishuTest}
                disabled={feishuTesting || !data.feishu.configured}
              >
                {feishuTesting ? tr("正在投递...") : tr("发送测试卡片到群")}
              </Button>
            </div>

            <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              <div style={{ padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("Webhook 地址")}</span>
                <p style={{ margin: "4px 0 0 0", fontFamily: "monospace", fontSize: "13px" }}>
                  {data.feishu.webhookUrlMasked || tr("未填写")}
                </p>
              </div>
              <div style={{ padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("安全签名 (HMAC-SHA256)")}</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
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
          <section className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{tr("邮件服务 (Resend)")}</span>
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: data.email.configured ? "rgba(16, 185, 129, 0.12)" : "rgba(107, 114, 128, 0.12)",
                      color: data.email.configured ? "#10b981" : "var(--muted)",
                      fontWeight: 500,
                    }}
                  >
                    {data.email.configured ? tr("已配置") : tr("未配置")}
                  </span>
                </h3>
                <p className="admin-secondary" style={{ margin: 0, fontSize: "13px" }}>
                  {tr("用于用户注册邮箱验证、找回密码与重要系统事务通知。")}
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={handleEmailTest}
                disabled={emailTesting || !data.email.configured}
              >
                {emailTesting ? tr("正在发送...") : tr("向管理员发送测试邮件")}
              </Button>
            </div>

            <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              <div style={{ padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("发件人邮箱 (EMAIL_FROM)")}</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
                  {data.email.emailFrom || tr("未设置")}
                </p>
              </div>
              <div style={{ padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("API Key 状态")}</span>
                <p style={{ margin: "4px 0 0 0", fontFamily: "monospace", fontSize: "13px" }}>
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
          <section className="card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px 0" }}>
                {tr("出海商业支付渠道")}
              </h3>
              <p className="admin-secondary" style={{ margin: 0, fontSize: "13px" }}>
                {tr("通过 PAYMENT_PROVIDER 环境变量自由切换，支持无缝热备与历史订单自动对账。")}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              {[
                { id: "pancake", name: "Waffo Pancake (默认 MoR)", ready: data.payments.pancake },
                { id: "stripe", name: "Stripe (信用卡订阅)", ready: data.payments.stripe },
                { id: "creem", name: "Creem (轻量 MoR)", ready: data.payments.creem },
                { id: "paypal", name: "PayPal (电子钱包)", ready: data.payments.paypal },
              ].map((p) => {
                const isActive = p.id === data.payments.activeProvider;
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: "16px",
                      background: "var(--surface)",
                      borderRadius: "8px",
                      border: isActive ? "1px solid var(--color-primary, #6366f1)" : "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13px" }}>{p.name}</strong>
                      {isActive && (
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: "rgba(99, 102, 241, 0.12)",
                            color: "var(--color-primary, #6366f1)",
                            fontWeight: 600,
                          }}
                        >
                          {tr("当前默认")}
                        </span>
                      )}
                    </div>
                    <small style={{ color: p.ready ? "#10b981" : "var(--muted)", display: "block", fontSize: "12px" }}>
                      {p.ready ? tr("凭据完整，可正常收款") : tr("未配置全部密钥")}
                    </small>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. Google 登录与一键 One Tap */}
          <section className="card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "14px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{tr("谷歌一键登录 (Google OAuth & One Tap)")}</span>
                <span
                  style={{
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: data.google.configured ? "rgba(16, 185, 129, 0.12)" : "rgba(107, 114, 128, 0.12)",
                    color: data.google.configured ? "#10b981" : "var(--muted)",
                    fontWeight: 500,
                  }}
                >
                  {data.google.configured ? tr("已就绪") : tr("未配置")}
                </span>
              </h3>
              <p className="admin-secondary" style={{ margin: 0, fontSize: "13px" }}>
                {tr("支持标准 Google OAuth 授权重定向，并已开启 FedCM / GIS 一键浮层快捷登录。")}
              </p>
            </div>

            <div style={{ padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
              <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("Google Client ID")}</span>
              <p style={{ margin: "4px 0 0 0", fontFamily: "monospace", fontSize: "13px" }}>
                {data.google.clientIdMasked || tr("未配置 (配置后自动激活全站 One Tap)")}
              </p>
            </div>
          </section>

          {/* 5. 存储与数据库 */}
          <section className="card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px 0" }}>
                {tr("边缘数据库与对象存储")}
              </h3>
              <p className="admin-secondary" style={{ margin: 0, fontSize: "13px" }}>
                {tr("Cloudflare D1 边缘 SQLite 数据库与 Cloudflare R2 私有对象存储。")}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("注册用户总数")}</span>
                <div style={{ margin: "6px 0 0 0", fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>
                  {data.storage.totalUsers.toLocaleString()} <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--muted)" }}>{tr("人")}</span>
                </div>
              </div>
              <div style={{ padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("R2 存储文件数")}</span>
                <div style={{ margin: "6px 0 0 0", fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>
                  {data.storage.totalFiles.toLocaleString()} <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--muted)" }}>{tr("个")}</span>
                </div>
              </div>
              <div style={{ padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <span className="admin-secondary" style={{ fontSize: "12px" }}>{tr("R2 已用存储空间")}</span>
                <div style={{ margin: "6px 0 0 0", fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>
                  {formatBytes(data.storage.totalStorageBytes)}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
