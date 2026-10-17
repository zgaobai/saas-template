import "@tanstack/react-start/server-only";
import { orderMode, paymentReference } from "../plan-contract";
import { bindings, required } from "@/server/env";
import { HttpError } from "@/server/http";
import {
  pancakeApi,
  verifyPancakeWebhook,
} from "@/modules/integrations/server/pancake";
import { cents, checkoutUrl } from "../../validation";
import { providerId, rawWebhook, timestamp } from "./transport";
import type {
  CheckoutInput,
  IntegratedPaymentProvider,
  Reconciliation,
  VerifiedSubscription,
} from "./contract";

interface LocalOrder {
  id: string;
  user_id: string;
  provider: string;
  plan_id: string;
  payment_mode: string | null;
  billing_interval: string | null;
  amount: number;
  currency: string;
}
interface RemoteOrder {
  id: string;
  status: string;
  metadata: string;
  orderMerchantExternalId: string;
  updatedAt: string;
  billingPeriod?: string;
  currentPeriodNumber?: number | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}
interface RemotePayment {
  id: string;
  orderId: string;
  status: string;
  orderMerchantExternalId: string;
  periodNumber?: number | null;
  // GraphQL Money.amount is an integer string in minor units; snapshot totals
  // are list prices, so they must not be used as evidence of the charged amount.
  amount: { amount: string; currency: string };
  refunds: Array<{
    id: string;
    status: string;
    pspAmountDetails: { amount: string; currency: string } | null;
  }>;
}
const storeId = () =>
  providerId(required(bindings().PANCAKE_STORE_ID, "PANCAKE_STORE_ID"));
const query = <T>(query: string, variables: Record<string, unknown>) =>
  pancakeApi<T>("/v1/graphql", { query, variables });

async function localOrder(ref: string): Promise<LocalOrder> {
  const order = await bindings()
    .DB.prepare("SELECT * FROM orders WHERE id=?")
    .bind(providerId(ref))
    .first<LocalOrder>();
  if (!order || order.provider !== "pancake")
    throw new Error("Pancake order identity mismatch");
  return order;
}
function owner(remote: RemoteOrder, local: LocalOrder) {
  const metadata =
    typeof remote.metadata === "string" ? JSON.parse(remote.metadata) : null;
  if (
    remote.orderMerchantExternalId !== local.id ||
    metadata?.orderId !== local.id ||
    metadata?.userId !== local.user_id ||
    metadata?.planId !== local.plan_id
  )
    throw new Error("Pancake order owner mismatch");
  providerId(remote.id);
}
async function readOrder(local: LocalOrder) {
  const subscription = orderMode(local) === "subscription";
  const name = subscription ? "subscriptionOrders" : "onetimeOrders";
  const result = await query<{ orders: RemoteOrder[] }>(
    `query($storeId: String!, $ref: String!) {
      orders: ${name}(storeId: $storeId, filter: { orderMerchantExternalId: { eq: $ref } }, limit: 2) {
        id status metadata orderMerchantExternalId updatedAt
        ${subscription ? "billingPeriod currentPeriodNumber currentPeriodStart currentPeriodEnd" : ""}
      }
    }`,
    { storeId: storeId(), ref: local.id },
  );
  if (!Array.isArray(result.orders) || result.orders.length > 1)
    throw new Error("Ambiguous Pancake business reference");
  const remote = result.orders[0];
  if (remote) owner(remote, local);
  return remote;
}
async function readPayments(local: LocalOrder, remote: RemoteOrder) {
  const all: RemotePayment[] = [];
  // Do not silently drop older renewals/refunds at the API's default page size.
  for (let offset = 0; offset < 2000; offset += 100) {
    const result = await query<{ payments: RemotePayment[] }>(
      `query($ref: String!, $offset: Int!) {
        payments(filter: { orderMerchantExternalId: { eq: $ref } }, limit: 100, offset: $offset, orderBy: [created_at_asc]) {
          id orderId status orderMerchantExternalId periodNumber amount { amount currency }
          refunds { id status pspAmountDetails { amount currency } }
        }
      }`,
      { ref: local.id, offset },
    );
    if (!Array.isArray(result.payments))
      throw new Error("Invalid Pancake payments");
    for (const payment of result.payments) {
      if (
        payment.orderId !== remote.id ||
        payment.orderMerchantExternalId !== local.id
      )
        throw new Error("Pancake payment association mismatch");
      all.push(payment);
    }
    if (result.payments.length < 100) return all;
  }
  throw new Error("Pancake history requires manual reconciliation");
}
function state(remote: RemoteOrder, local: LocalOrder): VerifiedSubscription {
  const statuses: Record<string, VerifiedSubscription["status"]> = {
    pending: "AUTHORIZATION_REQUIRED",
    active: "ACTIVE",
    canceling: "CANCELING",
    canceled: "CANCELED",
    closed: "EXPIRED",
    past_due: "PAST_DUE",
  };
  const status = statuses[remote.status];
  if (
    !status ||
    remote.billingPeriod !==
      (local.billing_interval === "year" ? "yearly" : "monthly")
  )
    throw new Error("Unsupported Pancake subscription");
  return {
    orderId: local.id,
    userId: local.user_id,
    subscriptionId: remote.id,
    status,
    updatedAt: timestamp(remote.updatedAt),
  };
}
function charged(payment: RemotePayment, local: LocalOrder) {
  if (!/^\d+$/.test(payment.amount?.amount || ""))
    throw new Error("Invalid Pancake amount");
  const value = Number(payment.amount.amount);
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value !== local.amount ||
    payment.amount.currency !== local.currency
  )
    throw new Error("Pancake amount/currency mismatch");
  return value;
}
async function reconcile(
  local: LocalOrder,
  remote: RemoteOrder,
): Promise<Reconciliation> {
  const subscription = orderMode(local) === "subscription";
  const records = await readPayments(local, remote);
  const result: Reconciliation = {
    subscriptions: subscription ? [state(remote, local)] : [],
    payments: [],
    refunds: [],
    expiredOrderIds:
      !subscription && ["canceled", "closed"].includes(remote.status)
        ? [local.id]
        : [],
  };
  for (const payment of records) {
    if (payment.status !== "succeeded") continue;
    let coveredUntil = 0;
    let coveredFrom: number | undefined;
    if (subscription) {
      if (
        !Number.isInteger(payment.periodNumber) ||
        payment.periodNumber! < 1 ||
        !Number.isInteger(remote.currentPeriodNumber) ||
        remote.currentPeriodNumber! < payment.periodNumber!
      )
        throw new Error("Await canonical Pancake billing period");
      // Older charges never inherit the current subscription period. A failed
      // renewal advances the period too; only its own succeeded charge extends access.
      if (payment.periodNumber === remote.currentPeriodNumber) {
        const start = timestamp(remote.currentPeriodStart || undefined);
        coveredFrom = start;
        coveredUntil = timestamp(remote.currentPeriodEnd || undefined);
        if (coveredUntil <= start)
          throw new Error("Invalid Pancake billing period");
      }
    }
    result.payments!.push({
      orderId: local.id,
      userId: local.user_id,
      paymentId: providerId(payment.id),
      amount: charged(payment, local),
      currency: local.currency,
      ...(subscription
        ? {
            subscriptionId: remote.id,
            coveredUntil,
            ...(coveredFrom ? { coveredFrom } : {}),
          }
        : {}),
    });
    if (!Array.isArray(payment.refunds))
      throw new Error("Missing Pancake refund evidence");
    for (const refund of payment.refunds) {
      if (refund.status !== "succeeded") continue;
      const amount = cents(refund.pspAmountDetails?.amount);
      if (
        amount <= 0 ||
        amount > local.amount ||
        refund.pspAmountDetails?.currency !== local.currency
      )
        throw new Error("Pancake refund amount/currency mismatch");
      result.refunds!.push({
        refundId: providerId(refund.id),
        paymentId: payment.id,
        amount,
        currency: local.currency,
      });
    }
  }
  return result;
}
function successUrl() {
  // Pancake's channel rejects HTTP redirects even in test mode.
  const url = new URL("/billing?checkout=returned", bindings().APP_URL);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new HttpError(503, "支付联调需要配置可公网访问的 HTTPS 站点地址。");
  return url.href;
}
async function validateProduct(input: CheckoutInput) {
  successUrl();
  const id = providerId(
    required(
      input.productRef ?? paymentReference("pancake", input.planId),
      "PANCAKE_PRODUCT_ID",
    ),
  );
  const name =
    input.mode === "subscription" ? "subscriptionProducts" : "onetimeProducts";
  const result = await query<{
    store: {
      id: string;
      products: Array<{ id: string; status: string; billingPeriod?: string }>;
    } | null;
  }>(
    `query($storeId: String!) {
      store(id: $storeId) {
        id products: ${name} { id status ${input.mode === "subscription" ? "billingPeriod" : ""} }
      }
    }`,
    { storeId: storeId() },
  );
  const matches = result.store?.products.filter((p) => p.id === id);
  const product = matches?.[0];
  if (
    result.store?.id !== storeId() ||
    matches?.length !== 1 ||
    product?.status !== "active" ||
    (input.mode === "subscription" &&
      product.billingPeriod !==
        (input.interval === "year" ? "yearly" : "monthly"))
  )
    throw new Error("Pancake product does not match configured store/plan");
  return id;
}
export const pancakeProvider: IntegratedPaymentProvider = {
  id: "pancake",
  async validateCheckout(input) {
    await validateProduct(input);
  },
  async createCheckout(input) {
    const productId = await validateProduct(input);
    const session = await pancakeApi<{
      sessionId: string;
      checkoutUrl: string;
    }>("/v1/actions/checkout/create-session", {
      productId,
      currency: "USD",
      priceSnapshot: {
        amount: (input.amount / 100).toFixed(2),
        taxIncluded: true,
        taxCategory: "saas",
      },
      withTrial: false,
      buyerEmail: input.email,
      successUrl: successUrl(),
      expiresInSeconds: 3600,
      orderMerchantExternalId: input.orderId,
      metadata: {
        orderId: input.orderId,
        userId: input.userId,
        planId: input.planId,
      },
      language: "zh-Hans",
    });
    return {
      providerId: providerId(session.sessionId),
      url: checkoutUrl(session.checkoutUrl),
    };
  },
  async syncCheckout(input) {
    const local = await localOrder(input.orderId);
    if (
      local.user_id !== input.userId ||
      local.amount !== input.amount ||
      local.currency !== input.currency ||
      (orderMode(local) === "subscription") !== (input.mode === "subscription")
    )
      throw new Error("Recovery owner mismatch");
    const remote = await readOrder(local);
    // An issued session does not necessarily have an order yet. Missing read-back
    // is not proof that payment failed; preserve the existing URL and pending row.
    if (!remote) return { reconciliation: {} };
    return {
      reconciliation: await reconcile(local, remote),
      ...(remote.status === "pending" ? {} : { url: null }),
    };
  },
  async cancelSubscription(id) {
    await pancakeApi("/v1/actions/subscription-order/cancel-order", {
      orderId: providerId(id),
    });
  },
  async syncSubscription(id) {
    const local = await bindings()
      .DB.prepare(
        "SELECT o.* FROM orders o JOIN subscriptions s ON s.order_id=o.id WHERE s.provider_id=? AND o.provider='pancake'",
      )
      .bind(providerId(id))
      .first<LocalOrder>();
    if (!local) throw new Error("Unknown Pancake subscription");
    const remote = await readOrder(local);
    if (!remote || remote.id !== id)
      throw new Error("Subscription identity mismatch");
    return reconcile(local, remote);
  },
  async handleWebhook(request) {
    const raw = await rawWebhook(request);
    verifyPancakeWebhook(raw, request.headers.get("x-waffo-signature"));
    const event = JSON.parse(raw) as {
      id: string;
      eventType: string;
      storeId: string;
      mode: string;
      data: {
        orderId: string;
        orderMerchantExternalId: string;
        paymentId?: string;
      };
    };
    if (
      event.storeId !== storeId() ||
      event.mode !== (bindings().PANCAKE_ENVIRONMENT || "test")
    )
      throw new HttpError(400, "支付通知环境或店铺不匹配。");
    if (
      !/^(order\.completed|subscription\.(activated|payment_succeeded|renewed|uncanceled|canceling|canceled|past_due|recovered|closed)|refund\.(succeeded|failed))$/.test(
        event.eventType,
      )
    )
      return {};
    const local = await localOrder(event.data.orderMerchantExternalId);
    const remote = await readOrder(local);
    if (!remote || remote.id !== event.data.orderId)
      throw new Error("Await Pancake order read-back");
    const result = await reconcile(local, remote);
    if (
      event.data.paymentId &&
      [
        "order.completed",
        "subscription.payment_succeeded",
        "refund.succeeded",
      ].includes(event.eventType) &&
      !result.payments?.some((p) => p.paymentId === event.data.paymentId)
    )
      throw new Error("Await Pancake payment read-back");
    if (
      event.eventType === "refund.succeeded" &&
      !result.refunds?.some(
        (r) => r.refundId === event.id && r.paymentId === event.data.paymentId,
      )
    )
      throw new Error("Await Pancake refund read-back");
    return result;
  },
};
