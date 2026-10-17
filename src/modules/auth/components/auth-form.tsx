import { localizedPath } from "@/i18n/core";
import { useI18n } from "@/i18n/react";
import { AccountEmailAction } from "./account-email-action";
import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { authClient } from "../client";
export type AuthMode = "login" | "register" | "forgot" | "reset";
export function AuthForm({
  mode,
  caps,
  token,
  returnTo = "/",
  onModeChange,
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setPassword("");
    setVisible(false);
    setError("");
    setMessage("");
  }, [mode]);
  const isEntry = mode === "login" || mode === "register";
  const needsEmail = mode === "forgot" || (mode === "register" && !caps.local);
  async function success() {
    if (onSuccess) await onSuccess();
    else window.location.assign(localizedPath(returnTo, locale));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("email");
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        const r = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (r.error) throw new Error("邮箱或密码不正确，或邮箱尚未验证。");
        await success();
      } else if (mode === "register") {
        const r = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: localizedPath(returnTo, locale),
        });
        if (r.error)
          throw new Error(
            r.error.message || "注册未完成，请检查邮箱或稍后重试。",
          );
        if (caps.local) await success();
        else setMessage("请查收验证邮件，验证后即可登录。");
      } else if (mode === "forgot") {
        const r = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: localizedPath("/reset-password", locale),
        });
        if (r.error) throw new Error("暂时无法发送重置邮件，请稍后重试。");
        setMessage("如果该邮箱已注册，你将收到密码重置邮件。");
      } else {
        if (!token) throw new Error("重置链接无效，请重新申请。");
        const r = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (r.error) throw new Error("链接无效或已过期，请重新申请。");
        setMessage("密码已更新，现在可以返回登录。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(null);
    }
  }
  function switchLink(
    target: Exclude<AuthMode, "reset">,
    text: string,
    className?: string,
  ) {
    const to =
      target === "forgot" ? "/forgot-password" : (`/${target}` as const);
    return onModeChange ? (
      <button
        type="button"
        className={className ?? "auth-text-button"}
        disabled={Boolean(busy)}
        onClick={() => onModeChange(target)}
      >
        {text}
      </button>
    ) : (
      <Link
        to={to}
        search={{
          next: returnTo,
        }}
        className={className}
      >
        {text}
      </Link>
    );
  }
  return (
    <div className="auth-fields">
      {isEntry && (
        <>
          <Button
            variant="secondary"
            className="full-width auth-google"
            disabled={Boolean(busy) || !caps.auth || !caps.google}
            onClick={async () => {
              setBusy("google");
              setError("");
              try {
                const r = await authClient.signIn.social({
                  provider: "google",
                  callbackURL: localizedPath(returnTo, locale),
                  errorCallbackURL: localizedPath("/?auth=login", locale),
                });
                if (r.error) setError("Google 登录暂不可用，请使用邮箱登录。");
              } catch {
                setError("Google 登录暂不可用，请使用邮箱登录。");
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
            <span>
              {tr("或使用邮箱{0}", [tr(mode === "register" ? "注册" : "登录")])}
            </span>
          </div>
        </>
      )}
      {!caps.auth && <Notice>{tr("账户服务尚未开放，请稍后再来。")}</Notice>}
      {needsEmail && !caps.email && (
        <Notice>{tr("邮件服务暂不可用，请稍后重试。")}</Notice>
      )}
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {message && <Notice kind="success">{tr(message)}</Notice>}
      <form onSubmit={submit} aria-busy={Boolean(busy)}>
        <fieldset disabled={Boolean(busy)} className="auth-inputs">
          {mode === "register" && (
            <Field label={tr("昵称")} id={`${id}-name`}>
              <Input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder={tr("你的名字")}
                required
                maxLength={60}
              />
            </Field>
          )}
          {mode !== "reset" && (
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
          )}
          {mode !== "forgot" && (
            <div className="auth-password-field">
              <Field
                label={mode === "reset" ? tr("新密码") : tr("密码")}
                id={`${id}-password`}
                hint={mode === "login" ? undefined : tr("至少 12 个字符")}
              >
                <div className="auth-password">
                  <Input
                    id={`${id}-password`}
                    type={visible ? "text" : "password"}
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "login"
                        ? tr("输入密码")
                        : tr("设置至少 12 个字符的密码")
                    }
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={visible ? tr("隐藏密码") : tr("显示密码")}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              {mode === "login" && (
                <div className="auth-forgot">
                  {switchLink("forgot", tr("忘记密码？"))}
                </div>
              )}
            </div>
          )}
        </fieldset>
        <Button
          type="submit"
          disabled={
            Boolean(busy) ||
            !caps.auth ||
            (needsEmail && !caps.email) ||
            (mode === "reset" && (!token || Boolean(message)))
          }
          className="full-width auth-submit"
        >
          {busy === "email" && <LoaderCircle size={17} className="spin" />}
          {busy === "email"
            ? tr("处理中…")
            : mode === "login"
              ? tr("登录")
              : mode === "register"
                ? tr("创建账户")
                : mode === "forgot"
                  ? tr("发送重置邮件")
                  : tr("更新密码")}
        </Button>
      </form>
      {isEntry && caps.email && (error || message) && (
        <div className="auth-verification">
          <AccountEmailAction
            email={email}
            ready={caps.auth && caps.email}
            kind="verification"
            callbackURL={returnTo}
          />
        </div>
      )}
      <p className="auth-switch">
        {mode === "login" ? (
          <>
            {tr("还没有账户？")}
            {switchLink("register", tr("免费注册"))}
          </>
        ) : (
          <>
            {mode === "register" ? tr("已有账户？") : tr("想起密码了？")}
            {switchLink("login", tr("返回登录"))}
          </>
        )}
      </p>
      {isEntry && (
        <p className="fine-print">
          {tr("继续即表示你同意")}
          <Link to="/terms">{tr("使用条款")}</Link>
          {tr("和")}
          <Link to="/privacy">{tr("隐私说明")}</Link>
          {locale === "en" ? "." : "。"}
        </p>
      )}
    </div>
  );
}
