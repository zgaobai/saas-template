import { createTranslator, localeFromRequest } from "@/i18n/core";
import "@tanstack/react-start/server-only";
import { shortId } from "@/server/id";
import { site } from "@/site";
import { betterAuth } from "better-auth";
import { oneTap, magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db/client";
import { bindings, required } from "@/server/env";
import { sendAccountEmail } from "@/server/email";
export function auth() {
  const e = bindings();
  const local =
    e.APP_ENV === "development" &&
    ["localhost", "127.0.0.1"].includes(new URL(e.APP_URL).hostname);
  const secret = required(e.BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET");
  if (secret.length < 32)
    throw new Error("Authentication secret must have at least 32 characters");
  return betterAuth({
    appName: site.name,
    baseURL: e.APP_URL,
    secret,
    database: drizzleAdapter(db(), { provider: "sqlite" }),
    trustedOrigins: [e.APP_URL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: !local,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        const tr = createTranslator(localeFromRequest(request));
        return sendAccountEmail(
          user.email,
          tr("重置{0}密码", [tr(site.name)]),
          tr("请打开链接重置密码：{0}。如果不是你发起的请求，请忽略。", [url]),
        );
      },
    },
    emailVerification: {
      sendOnSignUp: !local,
      sendVerificationEmail: async ({ user, url }, request) => {
        const tr = createTranslator(localeFromRequest(request));
        return sendAccountEmail(
          user.email,
          tr("验证你的{0}邮箱", [tr(site.name)]),
          tr("请打开链接完成邮箱验证：{0}", [url]),
        );
      },
    },
    socialProviders:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: e.GOOGLE_CLIENT_ID,
              clientSecret: e.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }, ctx) => {
          const req = ctx?.headers
            ? new Request("http://localhost", { headers: ctx.headers })
            : undefined;
          const tr = createTranslator(localeFromRequest(req));
          if (local) {
            const { recordDevMagicLink } = await import("./dev-link");
            recordDevMagicLink(email, url);
            console.info(
              `\n========================================\n[Magic Link] 登录链接 for ${email}:\n${url}\n========================================\n`,
            );
          }
          if (!local || e.RESEND_API_KEY) {
            await sendAccountEmail(
              email,
              tr("登录{0}账号", [tr(site.name)]),
              tr(
                "请点击下方链接完成免密登录（10分钟内有效）：\n{0}\n\n如非本人操作，请忽略此邮件。",
                [url],
              ),
            );
          }
        },
      }),
      ...(e.GOOGLE_CLIENT_ID
        ? [
            oneTap({
              clientId: e.GOOGLE_CLIENT_ID,
            }),
          ]
        : []),
    ],
    rateLimit: { enabled: true, storage: "database", modelName: "rateLimit" },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser, context) => {
            try {
              const cookie = context?.headers?.get("cookie");
              const { recordUserAttribution, parseAttributionFromCookie } =
                await import("@/modules/attribution/server/service");
              const attr = parseAttributionFromCookie(cookie);
              await recordUserAttribution(createdUser.id, attr || undefined);
            } catch {
              // Non-blocking attribution hook
            }
          },
        },
      },
    },
    advanced: {
      database: { generateId: shortId },
      useSecureCookies: !local,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    session: { expiresIn: 60 * 60 * 24 * 7 },
  });
}
