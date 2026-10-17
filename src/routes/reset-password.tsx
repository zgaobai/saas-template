import { useI18n } from "@/i18n/react";
import { createFileRoute } from "@tanstack/react-router";
import { capabilities } from "@/modules/auth/functions";
import { AuthForm } from "@/modules/auth/components/auth-form";
export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      {
        name: "robots",
        content: "noindex,nofollow",
      },
    ],
  }),
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    token?: string;
  } => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  loader: () => capabilities(),
  component: Page,
});
function Page() {
  const { t: tr, locale } = useI18n();
  const caps = Route.useLoaderData();
  const { token } = Route.useSearch();
  return (
    <main className="auth-reset-page">
      <section className="auth-reset-card">
        <h1 className="auth-title">{tr("设置新密码")}</h1>
        <p className="auth-description">
          {tr("使用至少 12 个字符，保护你的账户。")}
        </p>
        <AuthForm mode="reset" caps={caps} token={token} />
      </section>
    </main>
  );
}
