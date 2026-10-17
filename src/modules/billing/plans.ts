import type { Locale } from "@/i18n/core";
export type BillingInterval = "month" | "year" | null;
export type PaymentBindings = {
  pancake?: string;
  stripe?: string;
  creem?: string;
  paypal?: string;
};
export type Plan = {
  annualPrice?: number | null;
  interval: BillingInterval;
  id: string;
  name: string;
  mode: "free" | "subscription" | "payment";
  price: number;
  credits: number;
  description: string;
  features: string[];
  enabled: boolean;
  revision: number;
};
export const legacyPlanNames: Record<string, string> = {
  starter: "体验版",
  creator: "创作者",
  pack: "灵感补给",
};
export const formatPrice = (
  cents: number,
  locale: Locale = "zh",
  currency = "USD",
) =>
  new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const paymentChannels = [
  { id: "pancake", name: "Waffo Pancake", implemented: true },
  { id: "stripe", name: "Stripe", implemented: true },
  { id: "creem", name: "Creem", implemented: true },
  { id: "paypal", name: "PayPal", implemented: true },
] as const;

export type AdminPlan = Plan & {
  paymentBindings: PaymentBindings;
  annualPaymentBindings?: PaymentBindings;
};
export function planTypeLabel(plan: Pick<Plan, "mode" | "interval">) {
  return plan.mode === "free"
    ? "免费体验"
    : plan.mode === "payment"
      ? "积分包"
      : plan.interval === "year"
        ? "年付订阅"
        : "月付订阅";
}

/** Annual billing is an offer of the same plan; credits and features are shared. */
export function supportsAnnual(plan: Plan) {
  return (
    plan.mode === "subscription" &&
    (plan.interval === "year" || (plan.annualPrice ?? 0) > 0)
  );
}
export function annualSavings(plan: Plan) {
  if (plan.interval === "year" || !plan.annualPrice) return null;
  const saved = plan.price * 12 - plan.annualPrice;
  return saved > 0
    ? { amount: saved, percent: Math.round((saved * 100) / (plan.price * 12)) }
    : null;
}
