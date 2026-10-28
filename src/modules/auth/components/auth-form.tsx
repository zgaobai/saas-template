import { localizedPath } from "@/i18n/core";
import { useI18n } from "@/i18n/react";
import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { authClient } from "../client";
import { trackLogin } from "@/modules/analytics/events";
import { getDevMagicLink } from "../functions";

export type AuthMode = "login" | "register" | "forgot" | "reset";
export function AuthForm({
  mode,
  caps,
  returnTo = "/",
  onSuccess,
}: {
  mode: AuthMode;
  caps: {
    auth: boolean;
    email: boolean;
    google: boolean;
    local: boolean;
  };
  token?: string;
  returnTo?: string;
  onModeChange?: (mode: Exclude<AuthMode, "reset">) => void;
  onSuccess?: () => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const id = useId();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [devMagicUrl, setDevMagicUrl] = useState<string | null>(null);

  async function sendMagicLink() {
    if (busy) return;
    if (!email.trim()) {
      setError(tr("请输入有效的邮箱地址。"));
      return;
    }
    setBusy("email");
    setError("");
    try {
      const r = await authClient.signIn.magicLink({
        email: email.trim(),
        callbackURL: localizedPath(returnTo, locale),
      });
      if (r.error) {
        throw new Error(r.error.message || tr("发送登录链接失败，请稍后重试。"));
      }
      setMagicLinkSent(true);
      trackLogin({ method: "magic-link" });
      if (caps.local) {
        try {
          const devUrl = await getDevMagicLink({ data: email.trim() });
          if (devUrl) setDevMagicUrl(devUrl);
        } catch {
          // local dev helper
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("操作失败，请重试。"));
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await sendMagicLink();
  }

  if (magicLinkSent) {
    return (
      <div className="auth-fields">
        <div className="auth-magic-sent">
          <div className="auth-magic-icon">
            <MailCheck size={28} />
          </div>
          <h3>{tr("登录链接已发送")}</h3>
          <p>
            {tr(
              "我们已向 {0} 发送了免密登录链接，请点击邮件中的链接完成登录（10分钟内有效）。",
              [email],
            )}
          </p>
          {devMagicUrl && (
            <Button
              type="button"
              variant="secondary"
              className="full-width dev-magic-btn"
              onClick={() => window.location.assign(devMagicUrl)}
            >
              {tr("点击此处直接登录 (本地模式)")}
            </Button>
          )}
          <div className="auth-magic-actions">
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={Boolean(busy)}
              onClick={() => void sendMagicLink()}
            >
              {busy === "email" ? tr("正在发送…") : tr("重新发送")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={Boolean(busy)}
              onClick={() => {
                setMagicLinkSent(false);
                setDevMagicUrl(null);
                setError("");
              }}
            >
              {tr("更换邮箱")}
            </Button>
          </div>
        </div>
        <p className="fine-print">
          {tr("继续即表示你同意")}
          <Link to="/terms">{tr("使用条款")}</Link>
          {tr("和")}
          <Link to="/privacy">{tr("隐私说明")}</Link>
          {locale === "en" ? "." : "。"}
        </p>
      </div>
    );
  }

  return (
    <div className="auth-fields">
      <Button
        variant="secondary"
        className="full-width auth-google"
        disabled={Boolean(busy) || !caps.auth || !caps.google}
        onClick={async () => {
          setBusy("google");
          setError("");
          trackLogin({ method: "google" });
          try {
            const r = await authClient.signIn.social({
              provider: "google",
              callbackURL: localizedPath(returnTo, locale),
              errorCallbackURL: localizedPath("/?auth=login", locale),
            });
            if (r.error) setError(tr("Google 登录暂不可用，请使用邮箱登录。"));
          } catch {
            setError(tr("Google 登录暂不可用，请使用邮箱登录。"));
          } finally {
            setBusy(null);
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.41 13.93A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.93V7.48H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.52l3.35-2.59Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.48l3.35 2.59C7.2 7.71 9.4 5.95 12 5.95Z"
          />
        </svg>
        {busy === "google"
          ? tr("正在连接 Google…")
          : tr("使用 Google 登录")}
      </Button>

      <div className="auth-divider">
        <span>{tr("或使用邮箱免密登录")}</span>
      </div>

      {!caps.auth && <Notice>{tr("账户服务尚未开放，请稍后再来。")}</Notice>}
      {!caps.local && !caps.email && (
        <Notice>{tr("邮件服务暂不可用，请稍后重试。")}</Notice>
      )}
      {error && <Notice kind="error">{tr(error)}</Notice>}

      <form onSubmit={submit} aria-busy={Boolean(busy)}>
        <fieldset disabled={Boolean(busy)} className="auth-inputs">
          <Field label={tr("邮箱")} id={`${id}-email`}>
            <Input
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          </Field>
        </fieldset>

        <Button
          type="submit"
          disabled={
            Boolean(busy) ||
            !caps.auth ||
            (!caps.local && !caps.email)
          }
          className="full-width auth-submit"
        >
          {busy === "email" && <LoaderCircle size={17} className="spin" />}
          {busy === "email" ? tr("正在发送…") : tr("发送免密登录链接")}
        </Button>
      </form>

      <p className="fine-print">
        {tr("继续即表示你同意")}
        <Link to="/terms">{tr("使用条款")}</Link>
        {tr("和")}
        <Link to="/privacy">{tr("隐私说明")}</Link>
        {locale === "en" ? "." : "。"}
      </p>
    </div>
  );
}
