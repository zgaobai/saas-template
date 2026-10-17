import "@tanstack/react-start/server-only";
import { HttpError } from "@/server/http";
import { bindings, paymentConfigured } from "@/server/env";
import { pancakeProvider } from "./pancake";
import { stripeProvider } from "./stripe";
import { creemProvider } from "./creem";
import { paypalProvider } from "./paypal";
import type { PaymentProviderId } from "./contract";
const providers = {
  pancake: pancakeProvider,
  stripe: stripeProvider,
  creem: creemProvider,
  paypal: paypalProvider,
};
export function paymentProvider(
  id: string = bindings().PAYMENT_PROVIDER || "pancake",
) {
  if (!Object.hasOwn(providers, id))
    throw new HttpError(400, "支付渠道配置不正确。");
  if (!paymentConfigured(id))
    throw new HttpError(503, "支付尚未开放，请稍后再试。");
  return providers[id as PaymentProviderId];
}
export function integratedProvider(id: string) {
  const p = paymentProvider(id);
  if (!("handleWebhook" in p))
    throw new HttpError(400, "支付渠道不支持此接口。");
  return p;
}
