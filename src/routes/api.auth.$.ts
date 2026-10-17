import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/modules/auth/server/auth";
import { endpoint } from "@/server/http";
import {
  normalizeUserEmail,
  validateEmailForRegistration,
} from "@/modules/auth/server/email-security";
import { bindings } from "@/server/env";
import { limitRequest } from "@/server/rate-limit";
import { createTranslator, localeFromRequest } from "@/i18n/core";

async function handleAuthPost(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (
    path.endsWith("/sign-up/email") ||
    path.endsWith("/sign-in/email") ||
    path.endsWith("/forget-password")
  ) {
    try {
      const cloned = request.clone();
      const body = (await cloned.json().catch(() => null)) as Record<
        string,
        any
      > | null;

      if (body && typeof body.email === "string" && body.email.trim()) {
        const rawEmail = body.email.trim();

        if (path.endsWith("/sign-up/email")) {
          // 1. IP rate limiting: max 10 sign-ups per hour per IP (Cloudflare edge headers)
          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-real-ip") ||
            (bindings().APP_ENV === "development" ? null : "anonymous");
          if (clientIp) {
            try {
              await limitRequest(clientIp, "auth:sign-up-ip", 10, 3600000);
            } catch {
              const tr = createTranslator(localeFromRequest(request));
              return new Response(
                JSON.stringify({
                  status: false,
                  message: tr("当前 IP 注册过于频繁，请稍后再试。"),
                }),
                {
                  status: 429,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
          }

          // 2. Anti-abuse: disposable email domain check & canonical normalization
          const check = validateEmailForRegistration(rawEmail, request);
          if (!check.valid) {
            return new Response(
              JSON.stringify({
                status: false,
                message: check.error,
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          body.email = check.normalized;
        } else {
          // Sign in & password reset: normalize email so alias variants can sign in
          body.email = normalizeUserEmail(rawEmail);
        }

        request = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(body),
        });
      }
    } catch {
      // Fall through to default Better-Auth handler on error
    }
  }

  return auth().handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => endpoint(() => auth().handler(request)),
      POST: ({ request }) => endpoint(() => handleAuthPost(request)),
    },
  },
});
