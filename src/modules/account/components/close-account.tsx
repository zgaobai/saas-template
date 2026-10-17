import { localizedPath } from "@/i18n/core";
import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { api } from "@/lib/api";
export function CloseAccount({ email }: { email: string }) {
  const { t: tr, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function close(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/app/account/close", {
        method: "POST",
        body: JSON.stringify({
          email: confirmedEmail,
          confirmation,
        }),
      });
      window.location.assign(localizedPath("/", locale));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "注销未完成，请稍后重试。",
      );
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>{tr("注销账户")}</h2>
      <p>
        {tr(
          "注销不可撤销。账户资料将匿名化，创作记录将删除，剩余积分和已付权益将放弃。必要账单记录会保留。",
        )}
      </p>
      <p>
        {tr(
          "请先保存需要的内容并删除个人文件，等待生成任务结束，处理待付款订单并取消自动续费。注销需要最近 5 分钟内重新登录。",
        )}
      </p>
      {!expanded ? (
        <Button
          type="button"
          variant="danger"
          onClick={() => setExpanded(true)}
        >
          {tr("申请注销账户")}
        </Button>
      ) : (
        <form onSubmit={close}>
          <Field id="close-email" label={tr("确认当前账户邮箱")}>
            <Input
              id="close-email"
              type="email"
              autoComplete="email"
              value={confirmedEmail}
              onChange={(e) => setConfirmedEmail(e.target.value)}
              required
              disabled={busy}
            />
          </Field>
          <Field
            id="close-confirmation"
            label={tr("输入 DELETE 确认")}
            hint={tr("确认后无法恢复此账户。")}
          >
            <Input
              id="close-confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              disabled={busy}
            />
          </Field>
          {error && <Notice kind="error">{tr(error)}</Notice>}
          {error.includes(tr("重新登录")) && (
            <p>
              <Link
                to="/login"
                search={{
                  next: "/settings",
                }}
              >
                {tr("重新登录后返回设置")}
              </Link>
            </p>
          )}
          <Button
            type="submit"
            variant="danger"
            disabled={
              busy ||
              confirmation !== "DELETE" ||
              confirmedEmail.toLowerCase() !== email.toLowerCase()
            }
          >
            {busy ? tr("正在注销…") : tr("确认永久注销")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setExpanded(false);
              setConfirmedEmail("");
              setConfirmation("");
              setError("");
            }}
          >
            {tr("保留账户")}
          </Button>
        </form>
      )}
    </section>
  );
}
