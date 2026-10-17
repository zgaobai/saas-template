import "@tanstack/react-start/server-only";
import { paymentReference } from "../plan-contract";
import { createHash } from "node:crypto";
import { bindings, required } from "@/server/env";
import { HttpError } from "@/server/http";
import { cents, checkoutUrl } from "../../validation";
import type {
  IntegratedPaymentProvider,
  Reconciliation,
  VerifiedPayment,
  VerifiedSubscription,
} from "./contract";
import { providerId, providerJson, rawWebhook, timestamp } from "./transport";

type Money = { value: string; currency_code: string };
type Link = { rel: string; href: string };
type Capture = {
  id: string;
  status: string;
  amount: Money;
  supplementary_data?: { related_ids?: { order_id?: string } };
  links?: Link[];
};
type Order = {
  id: string;
  status: string;
  purchase_units: Array<{
    custom_id: string;
    invoice_id: string;
    amount: Money;
    payments?: { captures?: Capture[] };
  }>;
  links?: Link[];
};
type Plan = {
  id?: string;
  status?: string;
  billing_cycles: Array<{
    tenure_type: string;
    frequency: { interval_unit: string; interval_count: number };
    total_cycles: number;
    pricing_scheme: { fixed_price: Money; tiers?: unknown[] };
  }>;
  payment_preferences?: { setup_fee?: Money; auto_bill_outstanding?: boolean };
  taxes?: { percentage: string };
  quantity_supported?: boolean;
};
type Subscription = {
  id: string;
  plan_id: string;
  custom_id: string;
  status: string;
  status_update_time?: string;
  update_time?: string;
  create_time: string;
  quantity?: string;
  shipping_amount?: Money;
  plan_overridden?: boolean;
  plan?: Plan;
  billing_info?: {
    last_payment?: { time: string; amount: Money };
    next_billing_time?: string;
  };
  links?: Link[];
};
type Transaction = {
  id: string;
  status: string;
  time: string;
  amount_with_breakdown: { gross_amount: Money };
};
type Sale = {
  id: string;
  state: string;
  amount: { total: string; currency: string };
  billing_agreement_id: string;
  create_time: string;
};
type Api = <T>(
  path: string,
  method?: string,
  body?: unknown,
  key?: string,
) => Promise<T>;

function requestId(operation: string, id: string) {
  return `${operation}-${createHash("sha256").update(id).digest("hex").slice(0, 28)}`;
}
async function client(): Promise<Api> {
  const e = bindings();
  const origin = (
    e.PAYPAL_BASE_URL?.trim() ||
    (e.PAYPAL_ENVIRONMENT === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com")
  ).replace(/\/+$/, "");
  const credentials = `${required(e.PAYPAL_CLIENT_ID, "PAYPAL_CLIENT_ID")}:${required(e.PAYPAL_CLIENT_SECRET, "PAYPAL_CLIENT_SECRET")}`;
  const token = await providerJson<{ access_token: string }>(
    `${origin}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  );
  if (!token.access_token) throw new Error("Missing PayPal access token");
  return <T>(path: string, method = "GET", body?: unknown, key?: string) =>
    providerJson<T>(`${origin}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(key ? { "PayPal-Request-Id": key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}
function identity(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length !== 2)
    throw new Error("Invalid PayPal metadata");
  return { orderId: providerId(parsed[0]), userId: providerId(parsed[1]) };
}
function money(value: Money) {
  if (!value || value.currency_code !== "USD")
    throw new Error("Unsupported PayPal currency");
  const amount = cents(value.value);
  if (amount <= 0) throw new Error("Invalid PayPal amount");
  return { amount, currency: value.currency_code };
}
function approval(links?: Link[]) {
  const link = links?.find(
    (item) => item.rel === "approve" || item.rel === "payer-action",
  );
  const url = new URL(checkoutUrl(link?.href));
  if (
    ![
      "www.paypal.com",
      "www.sandbox.paypal.com",
      "paypal.com",
      "sandbox.paypal.com",
    ].includes(url.hostname)
  )
    throw new Error("Invalid PayPal approval host");
  return url.toString();
}
function validatePlan(
  plan: Plan,
  expected?: number,
  interval?: "month" | "year" | null,
) {
  const cycle = plan.billing_cycles?.[0];
  const price = cycle && money(cycle.pricing_scheme?.fixed_price).amount;
  if (
    plan.billing_cycles?.length !== 1 ||
    !cycle ||
    cycle.tenure_type !== "REGULAR" ||
    (interval
      ? cycle.frequency?.interval_unit !== interval.toUpperCase()
      : !["MONTH", "YEAR"].includes(cycle.frequency?.interval_unit || "")) ||
    cycle.frequency.interval_count !== 1 ||
    cycle.total_cycles !== 0 ||
    cycle.pricing_scheme?.tiers?.length ||
    (expected !== undefined && price !== expected) ||
    plan.quantity_supported ||
    Number(plan.taxes?.percentage || 0) !== 0 ||
    cents(plan.payment_preferences?.setup_fee?.value || "0") !== 0 ||
    plan.payment_preferences?.auto_bill_outstanding !== false
  ) {
    throw new Error(
      "PayPal plan must be a fixed USD monthly or yearly plan without trials, setup fees, taxes or outstanding balance collection",
    );
  }
}
function unitIdentity(order: Order) {
  if (order.purchase_units?.length !== 1)
    throw new Error("Unexpected PayPal purchase units");
  const unit = order.purchase_units[0];
  const owner = identity(unit.custom_id);
  if (unit.invoice_id !== owner.orderId)
    throw new Error("PayPal invoice mismatch");
  money(unit.amount);
  return { ...owner, unit };
}
async function verifyLocalCaptureOrder(order: Order) {
  const { unit, orderId, userId } = unitIdentity(order);
  const local = await bindings()
    .DB.prepare(
      "SELECT user_id,provider,provider_id,amount,currency,status FROM orders WHERE id=?",
    )
    .bind(orderId)
    .first<{
      user_id: string;
      provider: string;
      provider_id: string | null;
      amount: number;
      currency: string;
      status: string;
    }>();
  const amount = money(unit.amount);
  if (
    !local ||
    local.provider !== "paypal" ||
    local.user_id !== userId ||
    local.amount !== amount.amount ||
    local.currency !== amount.currency ||
    (local.provider_id && local.provider_id !== order.id) ||
    !["pending", "paid"].includes(local.status)
  ) {
    throw new Error("PayPal order does not match local checkout");
  }
}
function orderPayments(
  order: Order,
  captureId?: string,
  includeRefunded = false,
): VerifiedPayment[] {
  providerId(order.id);
  const { unit, ...owner } = unitIdentity(order);
  if (order.status !== "COMPLETED") return [];
  const captures = unit.payments?.captures || [];
  if (captures.length !== 1) throw new Error("Unexpected PayPal captures");
  const capture = captures[0];
  if (captureId && capture.id !== captureId)
    throw new Error("PayPal capture/order mismatch");
  if (
    !(
      includeRefunded
        ? ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"]
        : ["COMPLETED"]
    ).includes(capture.status)
  )
    return [];
  const paid = money(capture.amount);
  if (paid.amount !== money(unit.amount).amount)
    throw new Error("PayPal captured amount mismatch");
  return [{ ...owner, ...paid, paymentId: providerId(capture.id) }];
}
// HATEOAS is read only as an identifier. All requests still use the fixed API origin.
function linkedId(links: Link[] | undefined, resource: string): string {
  for (const link of links || []) {
    if (link.rel !== "up") continue;
    const url = new URL(link.href);
    const customHost = bindings().PAYPAL_BASE_URL
      ? (() => {
          try {
            return new URL(bindings().PAYPAL_BASE_URL!).hostname;
          } catch {
            return null;
          }
        })()
      : null;
    if (
      url.protocol !== "https:" ||
      ![
        "api.paypal.com",
        "api.sandbox.paypal.com",
        "api-m.paypal.com",
        "api-m.sandbox.paypal.com",
        ...(customHost ? [customHost] : []),
      ].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("Invalid PayPal resource link");
    const prefix = `/v2/payments/${resource}/`;
    if (url.pathname.startsWith(prefix))
      return providerId(url.pathname.slice(prefix.length));
  }
  throw new Error("Missing PayPal payment association");
}
async function capturePayment(api: Api, id: string, includeRefunded = false) {
  const capture = await api<Capture>(`/v2/payments/captures/${providerId(id)}`);
  if (capture.id !== id) throw new Error("PayPal capture identity mismatch");
  const orderId = providerId(capture.supplementary_data?.related_ids?.order_id);
  const order = await api<Order>(`/v2/checkout/orders/${orderId}`);
  if (order.id !== orderId) throw new Error("PayPal order identity mismatch");
  if (
    !(
      includeRefunded
        ? ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"]
        : ["COMPLETED"]
    ).includes(capture.status)
  )
    return [];
  const payments = orderPayments(order, id, includeRefunded);
  if (payments.length && payments[0].amount !== money(capture.amount).amount)
    throw new Error("PayPal capture amount mismatch");
  return payments;
}
async function subscription(api: Api, id: string) {
  const sub = await api<Subscription>(
    `/v1/billing/subscriptions/${providerId(id)}?fields=plan`,
  );
  if (
    sub.id !== id ||
    sub.plan_overridden ||
    (sub.quantity && sub.quantity !== "1") ||
    cents(sub.shipping_amount?.value || "0") !== 0
  )
    throw new Error("Unexpected PayPal subscription");
  const plan =
    sub.plan ||
    (await api<Plan>(`/v1/billing/plans/${providerId(sub.plan_id)}`));
  validatePlan(plan);
  sub.plan = plan;
  identity(sub.custom_id);
  return sub;
}
function subscriptionState(sub: Subscription): VerifiedSubscription {
  const statuses: Record<string, VerifiedSubscription["status"]> = {
    ACTIVE: "ACTIVE",
    APPROVAL_PENDING: "AUTHORIZATION_REQUIRED",
    APPROVED: "IN_PROGRESS",
    SUSPENDED: "PAST_DUE",
    CANCELLED: "CANCELED",
    EXPIRED: "EXPIRED",
  };
  const status = statuses[sub.status];
  if (!status) throw new Error("Unknown PayPal subscription status");
  return {
    ...identity(sub.custom_id),
    subscriptionId: sub.id,
    status,
    updatedAt: timestamp(
      sub.status_update_time || sub.update_time || sub.create_time,
    ),
  };
}
async function transactions(api: Api, id: string, start: number, end: number) {
  const query = new URLSearchParams({
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
  });
  const result = await api<{
    transactions?: Transaction[];
    total_pages?: number;
  }>(`/v1/billing/subscriptions/${providerId(id)}/transactions?${query}`);
  if ((result.total_pages || 0) > 1)
    throw new Error("PayPal transaction range requires reconciliation");
  return result.transactions || [];
}
function transactionPayment(
  sub: Subscription,
  transaction: Transaction,
  includeRefunded = false,
): VerifiedPayment | undefined {
  if (
    !(
      includeRefunded
        ? ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"]
        : ["COMPLETED"]
    ).includes(transaction.status)
  )
    return;
  const paid = money(transaction.amount_with_breakdown.gross_amount);
  const time = timestamp(transaction.time);
  let coveredUntil: number | undefined;
  const last = sub.billing_info?.last_payment;
  const next = sub.billing_info?.next_billing_time;
  // Never assign today's next billing time to an old or delayed webhook transaction.
  // Transaction membership and matching provider last-payment time are both required.
  if (
    !includeRefunded &&
    last &&
    next &&
    timestamp(last.time) === time &&
    money(last.amount).amount === paid.amount
  ) {
    const until = timestamp(next);
    const yearly =
      sub.plan?.billing_cycles?.[0]?.frequency?.interval_unit === "YEAR";
    if (until > time && until <= time + (yearly ? 367 : 32) * 86400000)
      coveredUntil = until;
  }
  return {
    ...identity(sub.custom_id),
    ...paid,
    paymentId: providerId(transaction.id),
    subscriptionId: sub.id,
    ...(coveredUntil ? { coveredUntil, coveredFrom: time } : {}),
  };
}
async function salePayment(
  api: Api,
  id: string,
  includeRefunded = false,
): Promise<Reconciliation> {
  const sale = await api<Sale>(`/v1/payments/sale/${providerId(id)}`);
  if (sale.id !== id) throw new Error("PayPal sale identity mismatch");
  if (
    !(
      includeRefunded
        ? ["completed", "partially_refunded", "refunded"]
        : ["completed"]
    ).includes(sale.state)
  )
    return {};
  const sub = await subscription(api, providerId(sale.billing_agreement_id));
  const at = timestamp(sale.create_time);
  const list = await transactions(api, sub.id, at - 86400000, at + 86400000);
  const transaction = list.find((item) => item.id === id);
  if (!transaction)
    throw new Error("PayPal sale not found in subscription transactions");
  const payment = transactionPayment(sub, transaction, includeRefunded);
  if (
    payment &&
    (payment.amount !== cents(sale.amount.total) ||
      payment.currency !== sale.amount.currency)
  )
    throw new Error("PayPal sale amount mismatch");
  return {
    payments: payment ? [payment] : [],
    subscriptions: [subscriptionState(sub)],
  };
}

export const paypalProvider: IntegratedPaymentProvider = {
  id: "paypal",
  async validateCheckout(input) {
    const custom = JSON.stringify([
      providerId(input.orderId),
      providerId(input.userId),
    ]);
    if (custom.length > 127) throw new Error("PayPal metadata exceeds limit");
    if (input.mode !== "subscription") return;
    const api = await client();
    const id = providerId(
      required(
        input.productRef ?? paymentReference("paypal", input.planId),
        "PAYPAL_PLAN_ID",
      ),
    );
    const plan = await api<Plan>(`/v1/billing/plans/${id}`);
    if (plan.id !== id || plan.status !== "ACTIVE")
      throw new Error("PayPal plan is not active");
    validatePlan(plan, input.amount, input.interval || "month");
  },
  async syncCheckout(input) {
    const api = await client();
    if (input.mode === "subscription") {
      const sub = await subscription(api, input.providerId);
      const who = identity(sub.custom_id);
      if (who.orderId !== input.orderId || who.userId !== input.userId)
        throw new Error("Subscription owner mismatch");
      const now = Date.now();
      const list = await transactions(api, sub.id, now - 32 * 86400000, now);
      return {
        reconciliation: {
          subscriptions: [subscriptionState(sub)],
          payments: list
            .map((item) => transactionPayment(sub, item))
            .filter((item): item is VerifiedPayment => Boolean(item)),
        },
        url: sub.status === "APPROVAL_PENDING" ? approval(sub.links) : null,
      };
    }
    let order = await api<Order>(
      `/v2/checkout/orders/${providerId(input.providerId)}`,
    );
    if (order.id !== input.providerId)
      throw new Error("PayPal order identity mismatch");
    const who = unitIdentity(order);
    if (
      who.orderId !== input.orderId ||
      who.userId !== input.userId ||
      money(who.unit.amount).amount !== input.amount ||
      money(who.unit.amount).currency !== input.currency
    )
      throw new Error("PayPal order owner/amount mismatch");
    if (order.status === "APPROVED") {
      await verifyLocalCaptureOrder(order);
      await api<Order>(
        `/v2/checkout/orders/${order.id}/capture`,
        "POST",
        {},
        requestId("capture", order.id),
      );
      order = await api<Order>(
        `/v2/checkout/orders/${providerId(input.providerId)}`,
      );
      if (order.id !== input.providerId)
        throw new Error("PayPal captured order identity mismatch");
    }
    return {
      reconciliation: {
        payments: orderPayments(order),
        ...(order.status === "VOIDED"
          ? { expiredOrderIds: [input.orderId] }
          : {}),
      },
      url: ["CREATED", "PAYER_ACTION_REQUIRED"].includes(order.status)
        ? approval(order.links)
        : null,
    };
  },
  async createCheckout(input) {
    const api = await client();
    const custom = JSON.stringify([
      providerId(input.orderId),
      providerId(input.userId),
    ]);
    if (custom.length > 127) throw new Error("PayPal metadata exceeds limit");
    const context = {
      return_url: `${bindings().APP_URL}/billing`,
      cancel_url: `${bindings().APP_URL}/billing`,
      shipping_preference: "NO_SHIPPING",
    };
    if (input.mode === "subscription") {
      const planId = providerId(
        required(
          input.productRef ?? paymentReference("paypal", input.planId),
          "PAYPAL_PLAN_ID",
        ),
      );
      const plan = await api<Plan>(`/v1/billing/plans/${planId}`);
      if (plan.id !== planId || plan.status !== "ACTIVE")
        throw new Error("PayPal plan is not active");
      validatePlan(plan, input.amount, input.interval || "month");
      const result = await api<Subscription>(
        "/v1/billing/subscriptions",
        "POST",
        {
          plan_id: planId,
          custom_id: custom,
          quantity: "1",
          application_context: { ...context, user_action: "SUBSCRIBE_NOW" },
        },
        requestId("sub", input.orderId),
      );
      const id = providerId(result.id);
      return {
        providerId: id,
        subscriptionId: id,
        url: approval(result.links),
      };
    }
    const result = await api<Order>(
      "/v2/checkout/orders",
      "POST",
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.orderId,
            custom_id: custom,
            invoice_id: input.orderId,
            description: input.name,
            amount: {
              currency_code: "USD",
              value: (input.amount / 100).toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: { ...context, user_action: "PAY_NOW" },
          },
        },
      },
      requestId("order", input.orderId),
    );
    return { providerId: providerId(result.id), url: approval(result.links) };
  },
  async cancelSubscription(id) {
    const api = await client();
    const sub = await subscription(api, id);
    if (["CANCELLED", "EXPIRED"].includes(sub.status)) return;
    await api(
      `/v1/billing/subscriptions/${providerId(id)}/cancel`,
      "POST",
      { reason: "Customer canceled future renewals" },
      requestId("cancel", id),
    );
  },
  async syncSubscription(id) {
    const api = await client();
    const sub = await subscription(api, id);
    const now = Date.now();
    const list = await transactions(api, id, now - 32 * 86400000, now);
    return {
      subscriptions: [subscriptionState(sub)],
      payments: list
        .map((item) => transactionPayment(sub, item))
        .filter((item): item is VerifiedPayment => Boolean(item)),
    };
  },
  async handleWebhook(request) {
    const raw = await rawWebhook(request);
    let event: { event_type: string; resource?: { id?: string } };
    try {
      event = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "通知格式无效。");
    }
    if (!event || typeof event.event_type !== "string")
      throw new HttpError(400, "通知格式无效。");
    const fields: Record<string, string> = {};
    for (const name of [
      "auth-algo",
      "cert-url",
      "transmission-id",
      "transmission-sig",
      "transmission-time",
    ]) {
      const value = request.headers.get(`paypal-${name}`);
      if (!value || value.length > 4096)
        throw new HttpError(401, "通知签名缺失。");
      fields[name.replaceAll("-", "_")] = value;
    }
    const api = await client();
    const verified = await api<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      "POST",
      {
        ...fields,
        webhook_id: required(bindings().PAYPAL_WEBHOOK_ID, "PAYPAL_WEBHOOK_ID"),
        webhook_event: event,
      },
    );
    if (verified.verification_status !== "SUCCESS")
      throw new HttpError(401, "通知签名无效。");
    const type = event.event_type;
    if (type === "CHECKOUT.ORDER.APPROVED") {
      const id = providerId(event.resource?.id);
      let order = await api<Order>(`/v2/checkout/orders/${id}`);
      if (order.id !== id) throw new Error("PayPal order identity mismatch");
      unitIdentity(order);
      if (order.status === "APPROVED") {
        await verifyLocalCaptureOrder(order);
        await api<Order>(
          `/v2/checkout/orders/${id}/capture`,
          "POST",
          {},
          requestId("capture", id),
        );
        order = await api<Order>(`/v2/checkout/orders/${id}`);
        if (order.id !== id)
          throw new Error("PayPal captured order identity mismatch");
      }
      return { payments: orderPayments(order) };
    }
    if (type === "PAYMENT.CAPTURE.COMPLETED")
      return {
        payments: await capturePayment(api, providerId(event.resource?.id)),
      };
    if (type === "PAYMENT.SALE.COMPLETED")
      return salePayment(api, providerId(event.resource?.id));
    if (type === "PAYMENT.CAPTURE.REFUNDED") {
      const id = providerId(event.resource?.id);
      const refund = await api<{
        id: string;
        status: string;
        amount: Money;
        links?: Link[];
      }>(`/v2/payments/refunds/${id}`);
      if (refund.id !== id) throw new Error("PayPal refund identity mismatch");
      if (refund.status !== "COMPLETED") return {};
      const paymentId = linkedId(refund.links, "captures");
      const payments = await capturePayment(api, paymentId, true);
      const amount = money(refund.amount);
      if (!payments[0] || amount.amount > payments[0].amount)
        throw new Error("PayPal refund amount mismatch");
      return { payments, refunds: [{ refundId: id, paymentId, ...amount }] };
    }
    if (type === "PAYMENT.SALE.REFUNDED") {
      const id = providerId(event.resource?.id);
      const refund = await api<{
        id: string;
        state: string;
        sale_id: string;
        amount: { total: string; currency: string };
      }>(`/v1/payments/refund/${id}`);
      if (refund.id !== id) throw new Error("PayPal refund identity mismatch");
      if (refund.state !== "completed") return {};
      const paymentId = providerId(refund.sale_id);
      const result = await salePayment(api, paymentId, true);
      const amount = money({
        value: refund.amount.total,
        currency_code: refund.amount.currency,
      });
      if (!result.payments?.[0] || amount.amount > result.payments[0].amount)
        throw new Error("PayPal refund amount mismatch");
      return { ...result, refunds: [{ refundId: id, paymentId, ...amount }] };
    }
    if (type.startsWith("BILLING.SUBSCRIPTION.")) {
      const sub = await subscription(api, providerId(event.resource?.id));
      return { subscriptions: [subscriptionState(sub)] };
    }
    return {};
  },
};
