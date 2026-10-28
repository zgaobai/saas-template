import { localizedPath } from "@/i18n/core";
import { useI18n } from "@/i18n/react";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, clearClientSessionCache } from "@/modules/auth/client";
import { clearResourceCache } from "@/lib/use-resource";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { CloseAccount } from "@/modules/account/components/close-account";
import { ShieldCheck } from "lucide-react";
export function AccountSettings({
  user,
  security: _security,
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
        description={tr("管理个人资料与账户安全。")}
        action={
          <Button
            variant="secondary"
            onClick={async () => {
              clearClientSessionCache();
              clearResourceCache();
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
        <section className="account-security-card">
          <h2>{tr("账户安全")}</h2>
          <p>{tr("当前账户已启用无密码安全登录体系。")}</p>
          <div className="security-status-badge">
            <ShieldCheck size={18} />
            <span>{tr("免密安全登录")} · {tr("已通过邮箱验证")}</span>
          </div>
          <p className="security-note">
            {tr("无需记忆复杂密码。登录时系统会向你的认证邮箱发送专属安全链接，点击即可直接进入，有效防范撞库与弱密码风险。")}
          </p>
          <Field id="security-email" label={tr("认证邮箱")}>
            <Input id="security-email" value={user.email} readOnly disabled />
          </Field>
        </section>
        <CloseAccount email={user.email} />
      </div>
    </div>
  );
}
