import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import type { PaymentBindings } from "../plans";

// Only legacy rows may infer their contract from the original built-in plan ID.
export function orderMode(order: {
  payment_mode?: string | null;
  plan_id: string;
}): "payment" | "subscription" {
  if (order.payment_mode === "payment" || order.payment_mode === "subscription")
    return order.payment_mode;
  return order.plan_id === "creator" ? "subscription" : "payment";
}
export function paymentReference(
  provider: string,
  planId: string,
  mappings: PaymentBindings = {},
) {
  const ref = mappings[provider as keyof PaymentBindings];
  if (ref) return ref;
  const e = bindings();
  if (provider === "pancake")
    return planId === "creator"
      ? e.PANCAKE_CREATOR_PRODUCT_ID
      : planId === "pack"
        ? e.PANCAKE_PACK_PRODUCT_ID
        : undefined;
  if (provider === "creem")
    return planId === "creator"
      ? e.CREEM_CREATOR_PRODUCT_ID
      : planId === "pack"
        ? e.CREEM_PACK_PRODUCT_ID
        : undefined;
  if (provider === "paypal" && planId === "creator")
    return e.PAYPAL_CREATOR_PLAN_ID;
  return undefined;
}

export function planOffer(
  plan: import("../plans").AdminPlan,
  interval?: "month" | "year",
) {
  const selected = interval ?? plan.interval;
  if (plan.mode !== "subscription") {
    if (interval) throw new Error("积分包不支持订阅周期。");
    return {
      price: plan.price,
      interval: null,
      paymentBindings: plan.paymentBindings,
    };
  }
  if (selected === plan.interval)
    return {
      price: plan.price,
      interval: selected,
      paymentBindings: plan.paymentBindings,
    };
  if (selected === "year" && plan.interval === "month" && plan.annualPrice)
    return {
      price: plan.annualPrice,
      interval: selected,
      paymentBindings: plan.annualPaymentBindings ?? {},
    };
  throw new Error("此套餐未开放所选计费方式。");
}
