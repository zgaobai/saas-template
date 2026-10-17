import { localizedPath } from "@/i18n/core";
import { useI18n } from "@/i18n/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { authClient } from "../client";
export function AccountEmailAction({
  email,
  ready,
  kind,
  callbackURL = "/settings",
}: {
  email: string;
  ready: boolean;
  kind: "verification" | "password";
  callbackURL?: string;
}) {
  const { t: tr, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function send() {
    setError("");
    setMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("请先填写有效的邮箱地址。");
      return;
    }
    setBusy(true);
    try {
      const result =
        kind === "verification"
          ? await authClient.sendVerificationEmail({
              email: email.trim(),
              callbackURL: localizedPath(callbackURL, locale),
            })
          : await authClient.requestPasswordReset({
              email: email.trim(),
              redirectTo: localizedPath("/reset-password", locale),
            });
      if (result.error) throw new Error();
      setMessage(
        kind === "verification"
          ? "如果该邮箱需要验证，你将收到验证邮件。请同时检查垃圾邮件。"
          : "如果该邮箱已注册，你将收到设置密码的邮件。设置后需重新登录。",
      );
      setCooldown(60);
    } catch {
      setError("邮件发送未完成，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {!ready && <Notice>{tr("邮件服务尚未配置，暂时无法发送邮件。")}</Notice>}
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {message && <Notice kind="success">{tr(message)}</Notice>}
      <Button
        type="button"
        variant="secondary"
        disabled={!ready || busy || cooldown > 0}
        onClick={() => void send()}
      >
        {busy
          ? tr("正在发送…")
          : cooldown
            ? tr("{0} 秒后可重发", [cooldown])
            : kind === "verification"
              ? tr("重新发送验证邮件")
              : tr("发送设置密码邮件")}
      </Button>
    </div>
  );
}
