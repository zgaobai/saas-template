import { I18nProvider, useI18n } from "@/i18n/react";
import { requestLocale } from "@/i18n/functions";
import { localeTag, createTranslator, localizedPath } from "@/i18n/core";
import {
  createRootRoute,
  HeadContent,
  Scripts,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { AuthDialogProvider } from "@/modules/auth/components/auth-dialog";
import { safeReturnTo } from "@/modules/tools/catalog";
import stylesheet from "@/styles/globals.css?url";
import { site } from "@/site";
import { publicSite } from "@/modules/seo/functions";
import { generateJsonLdSchema } from "@/modules/seo/geo";
import { Analytics } from "@/modules/seo/components/analytics";
export const Route = createRootRoute({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    auth?: "login" | "register" | "forgot";
    next?: string;
    lang?: "zh" | "en";
  } => ({
    lang:
      search.lang === "en" || search.lang === "zh" ? search.lang : undefined,
    auth:
      search.auth === "login" ||
      search.auth === "register" ||
      search.auth === "forgot"
        ? search.auth
        : undefined,
    next: search.next === undefined ? undefined : safeReturnTo(search.next),
  }),
  beforeLoad: async ({ search }) => {
    const [environment, locale] = await Promise.all([
      publicSite(),
      requestLocale({
        data: search.lang,
      }),
    ]);
    return {
      publicSite: {
        ...environment,
        locale,
      },
      locale,
    };
  },
  head: ({ match }) => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: `${createTranslator(match.context.locale)(site.name)} · ${match.context.locale === "en" ? "AI toolkit" : "AI 工具箱"}`,
      },
      {
        name: "description",
        content: createTranslator(match.context.locale)(site.description),
      },
      {
        name: "robots",
        content: match.context.publicSite?.indexable
          ? "index,follow"
          : "noindex,nofollow",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: stylesheet,
      },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          generateJsonLdSchema(
            match.context.publicSite,
            match.context.locale,
          ),
        ),
      },
    ],
  }),
  component: Root,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});
function NotFoundPage() {
  const { t: tr, locale } = useI18n();
  return (
    <main className="container legal">
      <h1>{tr("这一页还未抵达")}</h1>
      <p>{tr("地址可能已经变更。")}</p>
      <a href={localizedPath("/", locale)}>{tr("返回首页")}</a>
    </main>
  );
}
function ErrorPage() {
  const { t: tr, locale } = useI18n();
  return (
    <main className="container legal">
      <h1>{tr("页面暂时无法加载")}</h1>
      <p>{tr("请刷新重试。若问题持续，请联系站点管理员。")}</p>
      <a href={localizedPath("/", locale)}>{tr("返回首页")}</a>
    </main>
  );
}
function Root() {
  const { locale, publicSite } = Route.useRouteContext();
  return (
    <html lang={localeTag(locale)} data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('qihang-theme')==='light'?'light':'dark'}catch{}`,
          }}
        />
        <Analytics site={publicSite} />
        <HeadContent />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <button
            type="button"
            className="skip-link"
            onClick={() => {
              const main = document.getElementById("main-content");
              main?.focus({
                preventScroll: true,
              });
              main?.scrollIntoView();
            }}
          >
            {locale === "en" ? "Skip to main content" : "跳到主要内容"}
          </button>
          <div id="main-content" tabIndex={-1}>
            <AuthDialogProvider>
              <Outlet />
            </AuthDialogProvider>
          </div>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
