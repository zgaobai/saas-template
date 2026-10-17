import "@tanstack/react-start/server-only";
import { paymentReference } from "../plan-contract";
import { bindings, required } from "@/server/env";
import { HttpError } from "@/server/http";
import { checkoutUrl } from "../../validation";
import type {
  IntegratedPaymentProvider,
  CheckoutInput,
  Reconciliation,
  VerifiedPayment,
  VerifiedRefund,
  VerifiedSubscription,
} from "./contract";
import {
  providerId,
  providerJson,
  rawWebhook,
  timestamp,
  verifyHmac,
} from "./transport";

type Reference = string | { id: string };
interface Product {
  id: string;
  price: number;
  currency: string;
  status: string;
  billing_type: string;
  billing_period: string;
  tax_mode: string;
  recurring_interval?: string | null;
  recurring_interval_count?: number | null;
  business_net_pricing?: boolean;
  trial_period_days?: number | null;
  usage_prices?: unknown[];
}
interface Subscription {
  id: string;
  status: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  customer: Reference;
  last_transaction_id?: string;
}
interface Transaction {
  id: string;
  status: string;
  amount: number;
  amount_paid?: number | null;
  currency: string;
  refunded_amount?: number | null;
  order?: Reference;
  subscription?: Reference;
  customer?: Reference;
  period_end?: number;
  period_start?: number;
}
interface Checkout {
  id: string;
  status: string;
  request_id?: string;
  checkout_url?: string;
  metadata?: Record<string, unknown>;
  customer?: Reference;
  subscription?: Reference;
  order?: { id: string; transaction?: Reference; status: string };
}
function api<T>(path: string, body?: unknown): Promise<T> {
  const env = bindings();
  const base = (
    env.CREEM_BASE_URL?.trim() ||
    (env.CREEM_ENVIRONMENT === "production"
      ? "https://api.creem.io"
      : "https://test-api.creem.io")
  ).replace(/\/+$/, "");
  return providerJson<T>(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-api-key": required(env.CREEM_API_KEY, "CREEM_API_KEY"),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function readSubscription(id: string) {
  const result = await api<Subscription>(
    `/v1/subscriptions?subscription_id=${providerId(id)}`,
  );
  if (result.id !== id) throw new Error("Subscription identity mismatch");
  return result;
}
async function readTransaction(reference: unknown) {
  const id = providerId(reference);
  const result = await api<Transaction>(
    `/v1/transactions?transaction_id=${id}`,
  );
  if (result.id !== id) throw new Error("Transaction identity mismatch");
  return result;
}
function identity(metadata?: Record<string, unknown>) {
  return {
    orderId: providerId(metadata?.orderId),
    userId: providerId(metadata?.userId),
  };
}
function subscriptionState(subscription: Subscription): VerifiedSubscription {
  const statuses: Record<string, VerifiedSubscription["status"]> = {
    active: "ACTIVE",
    scheduled_cancel: "CANCELED",
    canceled: "CANCELED",
    past_due: "PAST_DUE",
    unpaid: "PAST_DUE",
    expired: "EXPIRED",
    paused: "IN_PROGRESS",
    trialing: "IN_PROGRESS",
  };
  const status = statuses[subscription.status];
  if (!status) throw new Error("Unsupported subscription state");
  return {
    ...identity(subscription.metadata),
    subscriptionId: providerId(subscription),
    status,
    updatedAt: timestamp(subscription.updated_at),
  };
}
function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error("Invalid payment amount");
  return value;
}
function currency(value: string) {
  if (!/^[A-Z]{3}$/.test(value)) throw new Error("Invalid payment currency");
  return value;
}
function refund(transaction: Transaction): VerifiedRefund[] {
  if (!transaction.refunded_amount) return [];
  if (
    !["refunded", "partialRefund", "chargedBack", "chargeback"].includes(
      transaction.status,
    )
  )
    throw new Error("Unconfirmed refund");
  const refunded = amount(transaction.refunded_amount);
  if (refunded > amount(transaction.amount_paid ?? transaction.amount))
    throw new Error("Invalid refunded amount");
  // The API exposes a cumulative transaction total, not individually readable refunds.
  // The ledger applies only the positive difference from its previously recorded total.
  return [
    {
      refundId: `${transaction.id}:${refunded}`,
      paymentId: providerId(transaction),
      amount: refunded,
      currency: currency(transaction.currency),
      cumulative: true,
    },
  ];
}
function payment(
  transaction: Transaction,
  owner: ReturnType<typeof identity>,
  subscriptionId?: string,
): VerifiedPayment {
  if (
    ![
      "paid",
      "refunded",
      "partialRefund",
      "chargedBack",
      "chargeback",
    ].includes(transaction.status)
  )
    throw new Error("Unconfirmed payment");
  let coveredUntil: number | undefined;
  if (subscriptionId) {
    // Creem transaction period timestamps are milliseconds; never use the latest
    // subscription period for delayed historical payment events.
    coveredUntil = amount(transaction.period_end);
    if (coveredUntil < 1_000_000_000_000 || coveredUntil > 10_000_000_000_000)
      throw new Error("Invalid payment period");
  }
  return {
    ...owner,
    paymentId: providerId(transaction),
    amount: amount(transaction.amount_paid ?? transaction.amount),
    currency: currency(transaction.currency),
    ...(subscriptionId
      ? {
          subscriptionId,
          coveredUntil,
          ...(transaction.period_start
            ? { coveredFrom: amount(transaction.period_start) }
            : {}),
        }
      : {}),
  };
}
const subscriptionEvents = new Set([
  "subscription.active",
  "subscription.paid",
  "subscription.canceled",
  "subscription.scheduled_cancel",
  "subscription.past_due",
  "subscription.unpaid",
  "subscription.expired",
  "subscription.update",
  "subscription.trialing",
  "subscription.paused",
]);

async function validateProduct(input: CheckoutInput) {
  const configured =
    input.productRef ?? paymentReference("creem", input.planId);
  const productId = providerId(required(configured, "CREEM_PRODUCT_ID"));
  const product = await api<Product>(`/v1/products/${productId}`);
  const periodMatches =
    product.recurring_interval == null
      ? product.billing_period ===
        (input.interval === "year" ? "every-year" : "every-month")
      : product.recurring_interval === (input.interval || "month") &&
        product.recurring_interval_count === 1;
  if (
    product.id !== productId ||
    product.status !== "active" ||
    product.price !== input.amount ||
    product.currency !== "USD" ||
    product.tax_mode !== "inclusive" ||
    product.business_net_pricing ||
    product.trial_period_days ||
    product.usage_prices?.length ||
    (input.mode === "subscription"
      ? product.billing_type !== "recurring" || !periodMatches
      : product.billing_type !== "onetime")
  ) {
    throw new Error("Creem product does not match the configured plan");
  }

  return productId;
}
export const creemProvider: IntegratedPaymentProvider = {
  id: "creem",
  async validateCheckout(input) {
    await validateProduct(input);
  },
  async syncCheckout(input) {
    const checkout = await api<Checkout>(
      `/v1/checkouts?checkout_id=${providerId(input.providerId)}`,
    );
    const who = identity(checkout.metadata);
    if (
      checkout.id !== input.providerId ||
      checkout.request_id !== input.orderId ||
      who.orderId !== input.orderId ||
      who.userId !== input.userId
    )
      throw new Error("Checkout owner mismatch");
    if (checkout.status === "expired")
      return {
        reconciliation: { expiredOrderIds: [input.orderId] },
        url: null,
      };
    if (checkout.status !== "completed")
      return {
        reconciliation: {},
        ...(checkout.checkout_url
          ? { url: checkoutUrl(checkout.checkout_url) }
          : {}),
      };
    if (checkout.subscription) {
      if (input.mode !== "subscription")
        throw new Error("Checkout mode mismatch");
      const sub = await readSubscription(providerId(checkout.subscription));
      const state = subscriptionState(sub);
      if (state.orderId !== input.orderId || state.userId !== input.userId)
        throw new Error("Subscription owner mismatch");
      const transaction = sub.last_transaction_id
        ? await readTransaction(sub.last_transaction_id)
        : undefined;
      if (
        transaction &&
        (providerId(transaction.subscription) !== sub.id ||
          providerId(transaction.customer) !== providerId(sub.customer))
      )
        throw new Error("Payment association mismatch");
      return {
        reconciliation: {
          subscriptions: [state],
          payments: transaction ? [payment(transaction, who, sub.id)] : [],
          refunds: transaction ? refund(transaction) : [],
        },
        url: null,
      };
    }
    if (input.mode !== "payment" || !checkout.order)
      throw new Error("Checkout mode mismatch");
    const transaction = await readTransaction(checkout.order.transaction);
    if (
      providerId(transaction.order) !== providerId(checkout.order) ||
      transaction.subscription ||
      providerId(transaction.customer) !== providerId(checkout.customer)
    )
      throw new Error("Payment association mismatch");
    return {
      reconciliation: {
        payments: [payment(transaction, who)],
        refunds: refund(transaction),
      },
      url: null,
    };
  },
  async createCheckout(input) {
    const env = bindings();
    const productId = await validateProduct(input);
    const checkout = await api<Checkout>("/v1/checkouts", {
      product_id: productId,
      units: 1,
      request_id: input.orderId,
      customer: { email: input.email },
      metadata: { orderId: input.orderId, userId: input.userId },
      success_url: new URL("/billing?checkout=returned", env.APP_URL).href,
    });
    return {
      providerId: providerId(checkout),
      url: checkoutUrl(checkout.checkout_url),
    };
  },
  async cancelSubscription(id) {
    await api(`/v1/subscriptions/${providerId(id)}/cancel`, {
      mode: "scheduled",
      onExecute: "cancel",
    });
  },
  async syncSubscription(id) {
    return {
      subscriptions: [
        subscriptionState(await readSubscription(providerId(id))),
      ],
    };
  },
  async handleWebhook(request): Promise<Reconciliation> {
    const raw = await rawWebhook(request);
    verifyHmac(
      raw,
      request.headers.get("creem-signature"),
      required(bindings().CREEM_WEBHOOK_SECRET, "CREEM_WEBHOOK_SECRET"),
    );
    let event: { eventType?: string; object?: Record<string, unknown> };
    try {
      event = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "通知格式无效。");
    }
    const type = event?.eventType;
    if (
      !type ||
      (!subscriptionEvents.has(type) &&
        type !== "checkout.completed" &&
        type !== "refund.created" &&
        type !== "dispute.created")
    )
      return {};
    const object = event.object;
    if (!object) throw new HttpError(400, "通知格式无效。");
    if (type === "checkout.completed") {
      const id = providerId(object);
      const checkout = await api<Checkout>(`/v1/checkouts?checkout_id=${id}`);
      if (checkout.id !== id || checkout.status !== "completed")
        throw new Error("Unconfirmed checkout");
      const owner = identity(checkout.metadata);
      if (checkout.request_id !== owner.orderId)
        throw new Error("Checkout identity mismatch");
      if (checkout.subscription) {
        const subscription = await readSubscription(
          providerId(checkout.subscription),
        );
        const state = subscriptionState(subscription);
        if (state.orderId !== owner.orderId || state.userId !== owner.userId)
          throw new Error("Subscription owner mismatch");
        // Webhook credits come from subscription.paid; explicit owned recovery may
        // read the same canonical transaction and uses the same idempotent receipt.
        return { subscriptions: [state] };
      }
      if (!checkout.order) throw new Error("Missing checkout order");
      const transaction = await readTransaction(checkout.order.transaction);
      if (
        providerId(transaction.order) !== providerId(checkout.order) ||
        transaction.subscription ||
        providerId(transaction.customer) !== providerId(checkout.customer)
      )
        throw new Error("Payment association mismatch");
      return {
        payments: [payment(transaction, owner)],
        refunds: refund(transaction),
      };
    }
    if (subscriptionEvents.has(type)) {
      const subscription = await readSubscription(providerId(object));
      const state = subscriptionState(subscription);
      if (type !== "subscription.paid") return { subscriptions: [state] };
      const transaction = await readTransaction(object.last_transaction_id);
      if (
        providerId(transaction.subscription) !== subscription.id ||
        providerId(transaction.customer) !== providerId(subscription.customer)
      )
        throw new Error("Payment association mismatch");
      return {
        subscriptions: [state],
        payments: [
          payment(
            transaction,
            identity(subscription.metadata),
            subscription.id,
          ),
        ],
        refunds: refund(transaction),
      };
    }
    const transaction = await readTransaction(object.transaction);
    const refunds = refund(transaction);
    // A signed notification can precede API settlement; request delivery retry
    // instead of acknowledging a refund that has not reached the read model.
    if (!refunds.length) throw new Error("Refund not yet confirmed");
    return { refunds };
  },
};
