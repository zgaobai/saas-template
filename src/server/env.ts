import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import requirements from "./integration-requirements.json";
export interface Bindings {
  DB: D1Database;
  FILES: R2Bucket;
  APP_URL: string;
  APP_ENV: "development" | "staging" | "production";
  BETTER_AUTH_SECRET?: string;
  REDEMPTION_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OPENAI_API_KEY?: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
  AI_API_STYLE?: "responses" | "chat";
  PAYMENT_PROVIDER?: "pancake" | "stripe" | "creem" | "paypal";
  PANCAKE_BASE_URL?: string;
  STRIPE_BASE_URL?: string;
  CREEM_BASE_URL?: string;
  PAYPAL_BASE_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  CREEM_API_KEY?: string;
  CREEM_WEBHOOK_SECRET?: string;
  CREEM_ENVIRONMENT?: "test" | "production";
  CREEM_CREATOR_PRODUCT_ID?: string;
  CREEM_PACK_PRODUCT_ID?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_WEBHOOK_ID?: string;
  PAYPAL_ENVIRONMENT?: "sandbox" | "production";
  PAYPAL_CREATOR_PLAN_ID?: string;
  ADMIN_USER_IDS?: string;
  PANCAKE_MERCHANT_ID?: string;
  PANCAKE_PRIVATE_KEY?: string;
  PANCAKE_WEBHOOK_PUBLIC_KEY?: string;
  PANCAKE_STORE_ID?: string;
  PANCAKE_CREATOR_PRODUCT_ID?: string;
  PANCAKE_PACK_PRODUCT_ID?: string;
  PANCAKE_ENVIRONMENT?: "test" | "prod";
  MODERATION_PROVIDER?: "pancake" | "creem" | "disabled";
  GA_MEASUREMENT_ID?: string;
  UMAMI_WEBSITE_ID?: string;
  UMAMI_SCRIPT_URL?: string;
}
export const bindings = () => env as unknown as Bindings;
export function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing server setting: ${name}`);
  return value;
}
function configured(group: keyof typeof requirements) {
  const e = bindings() as unknown as Record<string, unknown>;
  return requirements[group].every(
    (key) => typeof e[key] === "string" && String(e[key]).trim().length > 0,
  );
}
export function paymentConfigured(
  provider: string = bindings().PAYMENT_PROVIDER || "pancake",
) {
  if (!["pancake", "stripe", "creem", "paypal"].includes(provider))
    return false;
  return configured(provider as "pancake" | "stripe" | "creem" | "paypal");
}
// Explicit boolean allowlist: never spread bindings into a loader or API response.
export function publicCapabilities() {
  const e = bindings();
  return {
    auth: configured("auth"),
    email: configured("email"),
    google: configured("google"),
    ai: configured("ai"),
    payments: paymentConfigured(),
    local: e.APP_ENV === "development",
  };
}
