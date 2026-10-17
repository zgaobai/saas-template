import { localizedPath } from "@/i18n/core";
import { useI18n } from "@/i18n/react";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/modules/auth/client";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { CloseAccount } from "@/modules/account/components/close-account";
import { AccountEmailAction } from "@/modules/auth/components/account-email-action";
export function AccountSettings({
  user,
  security,
}: {
  user: {
    name: string;
    email: string;
  };
  security: {
    hasPassword: boolean;
    emailReady: boolean;
  };
}) {
  const { t: tr, locale } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(
    fn: () => Promise<{
      error: unknown;
    }>,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fn();
      if (r.error) throw new Error("更新未完成，请检查输入后重试。");
      setMessage("已保存。");
      setCurrent("");
      setNext("");
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-page">
      <PageHeading
        title={tr("账户设置")}
        description={tr("管理个人资料、登录密码和账户安全。")}
        action={
          <Button
            variant="secondary"
            onClick={async () => {
              const r = await authClient.signOut();
              if (r.error) {
                setError("退出失败，请重试。");
                return;
              }
              window.location.assign(localizedPath("/", locale));
            }}
          >
            {tr("退出登录")}
          </Button>
        }
      />
      {message && <Notice kind="success">{tr(message)}</Notice>}
      {error && <Notice kind="error">{tr(error)}</Notice>}
      <div className="settings-content account-settings">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              authClient.updateUser({
                name,
              }),
            );
          }}
        >
          <h2>{tr("个人信息")}</h2>
          <Field id="profile-name" label={tr("显示名称")}>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={60}
            />
          </Field>
          <Field id="profile-email" label={tr("登录邮箱")}>
            <Input id="profile-email" value={user.email} readOnly />
          </Field>
          <Button type="submit" disabled={busy}>
            {tr("保存名称")}
          </Button>
        </form>
        {security.hasPassword ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                authClient.changePassword({
                  currentPassword: current,
                  newPassword: next,
                  revokeOtherSessions: true,
                }),
              );
            }}
          >
            <h2>{tr("修改密码")}</h2>
            <p>{tr("更新后会退出其他设备上的登录。")}</p>
            <Field id="current-password" label={tr("当前密码")}>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </Field>
            <Field
              id="new-password"
              label={tr("新密码")}
              hint={tr("至少 12 个字符。")}
            >
              <Input
                id="new-password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={busy}>
              {tr("更新密码")}
            </Button>
          </form>
        ) : (
          <section>
            <h2>{tr("设置登录密码")}</h2>
            <p>
              {tr(
                "你目前使用第三方账号登录。通过邮箱设置密码后，也可以使用邮箱和密码登录。",
              )}
            </p>
            <AccountEmailAction
              email={user.email}
              ready={security.emailReady}
              kind="password"
            />
          </section>
        )}
        <CloseAccount email={user.email} />
      </div>
    </div>
  );
}
