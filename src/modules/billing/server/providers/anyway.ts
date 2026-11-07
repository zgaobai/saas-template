import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { paymentReference } from "../plan-contract";
import { bindings, required } from "@/server/env";
import { HttpError } from "@/server/http";
import { checkoutUrl } from "../../validation";
import type {
  IntegratedPaymentProvider,
  CheckoutInput,
  CheckoutRecoveryInput,
  CheckoutRecovery,
  Reconciliation,
  VerifiedPayment,
  VerifiedRefund,
  VerifiedSubscription,
} from "./contract";
import {
  providerId,
  providerJson,
  rawWebhook,
} from "./transport";

interface AnywayCheckoutSession {
  id: string;
  status: "open" | "completed" | "expired";
  merchantReference?: string;
  orderId?: string;
  paymentId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  url?: string;
  checkoutUrl?: string;
  paymentLinkUrl?: string;
  metadata?: Record<string, unknown>;
  customerEmail?: string;
  periodStart?: number | string;
  periodEnd?: number | string;
  productId?: string;
}

interface AnywayOrder {
  id: string;
  status: "paid" | "completed" | "refunded" | "partially_refunded" | "canceled";
  merchantReference?: string;
  amount: number;
  currency: string;
  refundedAmount?: number;
  subscriptionId?: string;
  metadata?: Record<string, unknown>;
  periodStart?: number | string;
  periodEnd?: number | string;
  createdAt?: number | string;
}

interface AnywaySubscription {
  id: string;
  status: "active" | "canceled" | "past_due" | "unpaid" | "expired" | "paused" | "trialing";
  merchantReference?: string;
  updatedAt?: number | string;
  metadata?: Record<string, unknown>;
  lastOrderId?: string;
}

interface AnywayProduct {
  id: string;
  name?: string;
  status?: string;
  price?: number;
  currency?: string;
  billingType?: "recurring" | "onetime";
  interval?: "month" | "year";
}

function getBaseUrl(): string {
  const env = bindings();
  if (env.ANYWAY_BASE_URL?.trim()) {
    return env.ANYWAY_BASE_URL.trim().replace(/\/+$/, "");
  }
  return env.ANYWAY_ENVIRONMENT === "production"
    ? "https://merchant-api-prod.anyway.sh"
    : "https://merchant-api-stg.anyway.sh";
}

async function api<T>(
  path: string,
  body?: unknown,
  method?: "GET" | "POST",
): Promise<T> {
  const env = bindings();
  const base = getBaseUrl();
  return providerJson<T>(base + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "X-API-Key": required(env.ANYWAY_API_KEY, "ANYWAY_API_KEY"),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function readCheckoutSession(id: string): Promise<AnywayCheckoutSession> {
  const safeId = providerId(id);
  const result = await api<AnywayCheckoutSession>(`/v1/checkout-sessions/${safeId}`);
  if (result.id !== id) throw new Error("Checkout session identity mismatch");
  return result;
}

async function readOrder(id: string): Promise<AnywayOrder> {
  const safeId = providerId(id);
  const result = await api<AnywayOrder>(`/v1/orders/${safeId}`);
  if (result.id !== id) throw new Error("Order identity mismatch");
  return result;
}

async function readSubscription(id: string): Promise<AnywaySubscription> {
  const safeId = providerId(id);
  const result = await api<AnywaySubscription>(`/v1/subscriptions/${safeId}`);
  if (result.id !== id) throw new Error("Subscription identity mismatch");
  return result;
}

function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error("Invalid payment amount");
  return value;
}

function parseTimestamp(value: string | number | undefined): number {
  if (!value) return Date.now();
  if (typeof value === "number") {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return Date.now();
}

function currency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value))
    throw new Error("Invalid payment currency");
  return value;
}

export function verifyAnywaySignature(
  rawBody: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  secret: string,
) {
  const { id, timestamp: ts, signature } = headers;
  if (!id || !ts || !signature) {
    throw new HttpError(401, "缺少签名头信息。");
  }

  const now = Math.floor(Date.now() / 1000);
  const msgTime = Number.parseInt(ts, 10);
  if (Number.isNaN(msgTime) || Math.abs(now - msgTime) > 300) {
    throw new HttpError(401, "签名无效或通知已过期。");
  }

  const toSign = `${id}.${ts}.${rawBody}`;

  let keyBuffer: Buffer;
  if (secret.startsWith("whsec_")) {
    keyBuffer = Buffer.from(secret.slice(6), "base64");
  } else {
    try {
      keyBuffer = Buffer.from(secret, "base64");
      if (keyBuffer.length === 0) keyBuffer = Buffer.from(secret, "utf8");
    } catch {
      keyBuffer = Buffer.from(secret, "utf8");
    }
  }

  const expected = createHmac("sha256", keyBuffer).update(toSign).digest();

  const sigParts = signature.split(/\s+/);
  let valid = false;

  for (const part of sigParts) {
    const [version, sigVal] = part.split(",");
    if (version === "v1" && sigVal) {
      try {
        const sigBuffer = Buffer.from(sigVal, "base64");
        if (
          sigBuffer.length === expected.length &&
          timingSafeEqual(expected, sigBuffer)
        ) {
          valid = true;
          break;
        }
      } catch {
        // continue
      }
    }
  }

  if (!valid) {
    throw new HttpError(401, "签名无效。");
  }
}

async function validateProduct(input: CheckoutInput): Promise<string> {
  const configured =
    input.productRef ?? paymentReference("anyway", input.planId);
  const productId = providerId(required(configured, "ANYWAY_PRODUCT_ID"));
  try {
    const product = await api<AnywayProduct>(`/v1/products/${productId}`);
    if (product.id && product.id !== productId) {
      throw new Error("Anyway product ID mismatch");
    }
    if (product.price !== undefined && product.price !== input.amount) {
      throw new Error("Anyway product price does not match plan amount");
    }
    if (product.currency !== undefined && product.currency !== "USD") {
      throw new Error("Anyway product currency must be USD");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("does not match")) {
      throw e;
    }
  }
  return productId;
}

export const anywayProvider: IntegratedPaymentProvider = {
  id: "anyway",

  async validateCheckout(input: CheckoutInput) {
    await validateProduct(input);
  },

  async createCheckout(input: CheckoutInput) {
    const env = bindings();
    const productId = await validateProduct(input);
    const checkout = await api<AnywayCheckoutSession>("/v1/checkout-sessions", {
      productId,
      merchantReference: input.orderId,
      customerEmail: input.email,
      successUrl: new URL("/billing?checkout=returned", env.APP_URL).href,
      cancelUrl: new URL("/pricing", env.APP_URL).href,
      metadata: {
        orderId: input.orderId,
        userId: input.userId,
        planId: input.planId,
        credits: input.credits,
      },
    });

    const url =
      checkout.url || checkout.checkoutUrl || checkout.paymentLinkUrl;
    if (!url) {
      throw new Error("Anyway checkout did not return a valid payment URL");
    }

    return {
      providerId: providerId(checkout.id),
      url: checkoutUrl(url),
      ...(checkout.subscriptionId
        ? { subscriptionId: checkout.subscriptionId }
        : {}),
    };
  },

  async syncCheckout(input: CheckoutRecoveryInput): Promise<CheckoutRecovery> {
    const checkout = await readCheckoutSession(input.providerId);
    const merchantRef =
      checkout.merchantReference ||
      (checkout.metadata?.orderId as string | undefined);
    const userId = checkout.metadata?.userId as string | undefined;

    if (merchantRef && merchantRef !== input.orderId) {
      throw new Error("Checkout order mismatch");
    }
    if (userId && userId !== input.userId) {
      throw new Error("Checkout user mismatch");
    }

    if (checkout.status === "expired") {
      return {
        reconciliation: { expiredOrderIds: [input.orderId] },
        url: null,
      };
    }

    if (checkout.status !== "completed") {
      const url =
        checkout.url || checkout.checkoutUrl || checkout.paymentLinkUrl;
      return {
        reconciliation: {},
        ...(url ? { url: checkoutUrl(url) } : {}),
      };
    }

    const paymentId = providerId(
      checkout.orderId || checkout.paymentId || checkout.id,
    );
    const paidAmount = amount(checkout.amount ?? input.amount);
    const paidCurrency = currency(checkout.currency ?? input.currency);

    const payments: VerifiedPayment[] = [
      {
        orderId: input.orderId,
        userId: input.userId,
        paymentId,
        amount: paidAmount,
        currency: paidCurrency,
        ...(checkout.subscriptionId
          ? {
              subscriptionId: checkout.subscriptionId,
              coveredUntil: checkout.periodEnd
                ? parseTimestamp(checkout.periodEnd)
                : Date.now() + 31 * 86400 * 1000,
              ...(checkout.periodStart
                ? { coveredFrom: parseTimestamp(checkout.periodStart) }
                : {}),
            }
          : {}),
      },
    ];

    const subscriptions: VerifiedSubscription[] = [];
    if (checkout.subscriptionId) {
      subscriptions.push({
        orderId: input.orderId,
        userId: input.userId,
        subscriptionId: providerId(checkout.subscriptionId),
        status: "ACTIVE",
        updatedAt: Date.now(),
      });
    }

    return {
      reconciliation: {
        payments,
        subscriptions,
      },
      url: null,
    };
  },

  async cancelSubscription(id: string): Promise<void> {
    await api(`/v1/subscriptions/${providerId(id)}/cancel`, {}, "POST");
  },

  async syncSubscription(id: string): Promise<Reconciliation> {
    const sub = await readSubscription(providerId(id));
    const statuses: Record<string, VerifiedSubscription["status"]> = {
      active: "ACTIVE",
      canceled: "CANCELED",
      past_due: "PAST_DUE",
      unpaid: "PAST_DUE",
      expired: "EXPIRED",
      paused: "IN_PROGRESS",
      trialing: "IN_PROGRESS",
    };
    return {
      subscriptions: [
        {
          orderId: providerId(
            sub.merchantReference || (sub.metadata?.orderId as string),
          ),
          userId: providerId(sub.metadata?.userId as string),
          subscriptionId: sub.id,
          status: statuses[sub.status] || "CANCELED",
          updatedAt: parseTimestamp(sub.updatedAt || Date.now()),
        },
      ],
    };
  },

  async handleWebhook(request: Request): Promise<Reconciliation> {
    const raw = await rawWebhook(request);
    const headers = {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    };

    verifyAnywaySignature(
      raw,
      headers,
      required(bindings().ANYWAY_WEBHOOK_SECRET, "ANYWAY_WEBHOOK_SECRET"),
    );

    let event: {
      id?: string;
      type?: string;
      eventType?: string;
      data?: Record<string, unknown>;
      object?: Record<string, unknown>;
    };
    try {
      event = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "通知格式错误。");
    }

    const eventType = event.type || event.eventType;
    const eventData = (event.data || event.object || {}) as Record<
      string,
      unknown
    >;

    switch (eventType) {
      case "order.paid":
      case "order.completed": {
        const orderId = providerId(eventData.id || eventData.orderId);
        const order = await readOrder(orderId);
        if (order.status !== "paid" && order.status !== "completed") {
          throw new Error("Unconfirmed Anyway order payment status");
        }
        const internalOrderId = providerId(
          order.merchantReference ||
            (order.metadata?.orderId as string | undefined),
        );
        const internalUserId = providerId(order.metadata?.userId as string);

        const payments: VerifiedPayment[] = [
          {
            orderId: internalOrderId,
            userId: internalUserId,
            paymentId: order.id,
            amount: amount(order.amount),
            currency: currency(order.currency),
            ...(order.subscriptionId
              ? {
                  subscriptionId: order.subscriptionId,
                  coveredUntil: order.periodEnd
                    ? parseTimestamp(order.periodEnd)
                    : Date.now() + 31 * 86400 * 1000,
                  ...(order.periodStart
                    ? { coveredFrom: parseTimestamp(order.periodStart) }
                    : {}),
                }
              : {}),
          },
        ];

        return { payments };
      }

      case "checkout.session.completed": {
        const sessionId = providerId(eventData.id || eventData.sessionId);
        const session = await readCheckoutSession(sessionId);
        if (session.status !== "completed") {
          throw new Error("Unconfirmed Anyway checkout status");
        }
        const internalOrderId = providerId(
          session.merchantReference ||
            (session.metadata?.orderId as string | undefined),
        );
        const internalUserId = providerId(session.metadata?.userId as string);
        const paymentId = providerId(
          session.orderId || session.paymentId || session.id,
        );

        const payments: VerifiedPayment[] = [
          {
            orderId: internalOrderId,
            userId: internalUserId,
            paymentId,
            amount: amount(session.amount),
            currency: currency(session.currency || "USD"),
            ...(session.subscriptionId
              ? {
                  subscriptionId: session.subscriptionId,
                  coveredUntil: session.periodEnd
                    ? parseTimestamp(session.periodEnd)
                    : Date.now() + 31 * 86400 * 1000,
                  ...(session.periodStart
                    ? { coveredFrom: parseTimestamp(session.periodStart) }
                    : {}),
                }
              : {}),
          },
        ];

        const subscriptions: VerifiedSubscription[] = [];
        if (session.subscriptionId) {
          subscriptions.push({
            orderId: internalOrderId,
            userId: internalUserId,
            subscriptionId: providerId(session.subscriptionId),
            status: "ACTIVE",
            updatedAt: Date.now(),
          });
        }

        return { payments, subscriptions };
      }

      case "order.refunded": {
        const orderId = providerId(eventData.id || eventData.orderId);
        const order = await readOrder(orderId);
        if (!order.refundedAmount) return {};
        const refunds: VerifiedRefund[] = [
          {
            refundId: `${order.id}:refund:${order.refundedAmount}`,
            paymentId: order.id,
            amount: amount(order.refundedAmount),
            currency: currency(order.currency),
            cumulative: true,
          },
        ];
        return { refunds };
      }

      case "subscription.canceled":
      case "subscription.expired":
      case "subscription.updated": {
        const subId = providerId(eventData.id || eventData.subscriptionId);
        const sub = await readSubscription(subId);
        const statuses: Record<string, VerifiedSubscription["status"]> = {
          active: "ACTIVE",
          canceled: "CANCELED",
          past_due: "PAST_DUE",
          unpaid: "PAST_DUE",
          expired: "EXPIRED",
          paused: "IN_PROGRESS",
          trialing: "IN_PROGRESS",
        };
        const status = statuses[sub.status] || "CANCELED";
        const internalOrderId = providerId(
          sub.merchantReference ||
            (sub.metadata?.orderId as string | undefined),
        );
        const internalUserId = providerId(sub.metadata?.userId as string);

        return {
          subscriptions: [
            {
              orderId: internalOrderId,
              userId: internalUserId,
              subscriptionId: sub.id,
              status,
              updatedAt: parseTimestamp(sub.updatedAt || Date.now()),
            },
          ],
        };
      }

      case "checkout.session.expired": {
        const sessionId = providerId(eventData.id || eventData.sessionId);
        const session = await readCheckoutSession(sessionId);
        const internalOrderId =
          session.merchantReference ||
          (session.metadata?.orderId as string | undefined);
        return {
          expiredOrderIds: internalOrderId ? [internalOrderId] : [],
        };
      }

      default:
        return {};
    }
  },
};
