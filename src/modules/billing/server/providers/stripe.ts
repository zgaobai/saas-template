import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { bindings, required } from "@/server/env";
import { HttpError } from "@/server/http";
import { checkoutUrl } from "../../validation";
import type {
  IntegratedPaymentProvider,
  CheckoutInput,
  CheckoutRecoveryInput,
  Reconciliation,
  VerifiedPayment,
  VerifiedSubscription,
} from "./contract";
import { providerId, providerJson, rawWebhook, timestamp } from "./transport";

// Pinned deliberately: Basil changed invoice payment/subscription relationships.
// https://docs.stripe.com/api/invoices/object?api-version=2024-06-20
const API_VERSION = "2024-06-20";
type Ref = string | { id: string };
type Metadata = { orderId?: string; userId?: string };
type Subscription = {
  id: string;
  metadata: Metadata;
  customer: Ref;
  status: string;
  latest_invoice?: Ref | null;
  cancel_at_period_end?: boolean;
};
type SubscriptionSnapshot = Subscription & { observedAt: number };
type Intent = {
  id: string;
  metadata: Metadata;
  status: string;
  amount_received: number;
  currency: string;
  latest_charge: Ref;
  customer?: Ref | null;
};
type Charge = {
  id: string;
  payment_intent: Ref;
  invoice?: Ref | null;
  amount: number;
  currency: string;
  paid: boolean;
  status: string;
  customer?: Ref | null;
};
type Invoice = {
  id: string;
  subscription: Ref;
  customer: Ref;
  payment_intent: Ref;
  charge: Ref;
  status: string;
  paid: boolean;
  paid_out_of_band: boolean;
  amount_paid: number;
  amount_due: number;
  total: number;
  currency: string;
  billing_reason: string;
  lines: {
    data: {
      type: string;
      subscription?: Ref;
      proration: boolean;
      period: { start?: number; end: number };
    }[];
    has_more: boolean;
  };
};
type Session = {
  id: string;
  mode: string;
  status: string;
  payment_status: string;
  metadata: Metadata;
  client_reference_id: string;
  amount_total: number;
  currency: string;
  payment_intent?: Ref;
  subscription?: Ref;
  url?: string;
};
type Refund = {
  id: string;
  charge: Ref;
  payment_intent: Ref;
  status: string;
  amount: number;
  currency: string;
};

async function api<T>(
  path: string,
  form?: URLSearchParams,
  idempotency?: string,
): Promise<T> {
  const baseUrl = (
    bindings().STRIPE_BASE_URL?.trim() || "https://api.stripe.com"
  ).replace(/\/+$/, "");
  return providerJson<T>(`${baseUrl}/v1/${path}`, {
    method: form ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${required(bindings().STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY")}`,
      "Stripe-Version": API_VERSION,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: form?.toString(),
  });
}
function check(condition: unknown): asserts condition {
  if (!condition) throw new Error("Stripe verification failed");
}
function owner(metadata: Metadata) {
  check(
    metadata &&
      typeof metadata.orderId === "string" &&
      metadata.orderId.length > 0 &&
      metadata.orderId.length <= 200,
  );
  check(
    typeof metadata.userId === "string" &&
      metadata.userId.length > 0 &&
      metadata.userId.length <= 200,
  );
  return { orderId: metadata.orderId, userId: metadata.userId };
}
function money(amount: number, currency: string) {
  check(Number.isSafeInteger(amount) && amount > 0 && currency === "usd");
}
function sameOwner(a: Metadata, b: Metadata) {
  const x = owner(a),
    y = owner(b);
  check(x.orderId === y.orderId && x.userId === y.userId);
}
function subscriptionState(sub: SubscriptionSnapshot): VerifiedSubscription {
  const statuses: Record<string, VerifiedSubscription["status"]> = {
    active: "ACTIVE",
    trialing: "IN_PROGRESS",
    incomplete: "AUTHORIZATION_REQUIRED",
    incomplete_expired: "EXPIRED",
    canceled: "CANCELED",
    past_due: "PAST_DUE",
    unpaid: "PAST_DUE",
    paused: "PAST_DUE",
  };
  check(statuses[sub.status]);
  return {
    ...owner(sub.metadata),
    subscriptionId: providerId(sub),
    // CANCELED means future renewals are stopped; paid-through access is retained by the ledger.
    status:
      sub.status === "active" && sub.cancel_at_period_end
        ? "CANCELED"
        : statuses[sub.status],
    updatedAt: sub.observedAt,
  };
}
async function readSubscription(id: string): Promise<SubscriptionSnapshot> {
  const observedAt = Date.now();
  const sub = await api<Subscription>(`subscriptions/${providerId(id)}`);
  check(sub.id === id);
  owner(sub.metadata);
  return { ...sub, observedAt };
}
async function receipt(intentId: string, amount: number, currency: string) {
  money(amount, currency);
  const intent = await api<Intent>(`payment_intents/${providerId(intentId)}`);
  check(
    intent.id === intentId &&
      intent.status === "succeeded" &&
      intent.amount_received === amount &&
      intent.currency === currency,
  );
  const charge = await api<Charge>(
    `charges/${providerId(intent.latest_charge)}`,
  );
  check(
    charge.id === providerId(intent.latest_charge) &&
      charge.paid === true &&
      charge.status === "succeeded" &&
      charge.amount === amount &&
      charge.currency === currency &&
      providerId(charge.payment_intent) === intent.id,
  );
  return { intent, charge };
}
async function invoicePayment(
  id: string,
  expectedSub?: SubscriptionSnapshot,
): Promise<
  { payment: VerifiedPayment; subscription: VerifiedSubscription } | undefined
> {
  const invoice = await api<Invoice>(`invoices/${providerId(id)}`);
  check(invoice.id === id);
  if (invoice.status !== "paid" || !invoice.paid) return undefined;
  // Manual/out-of-band settlement, trials, prorations and credits never mint a full allocation.
  if (
    !["subscription_create", "subscription_cycle"].includes(
      invoice.billing_reason,
    )
  )
    return undefined;
  check(
    invoice.paid_out_of_band === false &&
      invoice.amount_paid === invoice.amount_due &&
      invoice.amount_paid === invoice.total,
  );
  money(invoice.amount_paid, invoice.currency);
  const sub =
    expectedSub ?? (await readSubscription(providerId(invoice.subscription)));
  check(
    providerId(invoice.subscription) === sub.id &&
      providerId(invoice.customer) === providerId(sub.customer),
  );
  const { intent, charge } = await receipt(
    providerId(invoice.payment_intent),
    invoice.amount_paid,
    invoice.currency,
  );
  check(
    providerId(invoice.charge) === charge.id &&
      providerId(charge.invoice) === invoice.id &&
      providerId(intent.customer) === providerId(invoice.customer),
  );
  check(
    invoice.lines && !invoice.lines.has_more && invoice.lines.data.length === 1,
  );
  const line = invoice.lines.data[0];
  check(
    line.type === "subscription" &&
      !line.proration &&
      providerId(line.subscription) === sub.id,
  );
  return {
    subscription: subscriptionState(sub),
    payment: {
      ...owner(sub.metadata),
      paymentId: invoice.id,
      amount: invoice.amount_paid,
      currency: "USD",
      subscriptionId: sub.id,
      coveredUntil: timestamp(line.period.end),
      ...(line.period.start
        ? { coveredFrom: timestamp(line.period.start) }
        : {}),
    },
  };
}
async function reconcileSubscription(
  sub: SubscriptionSnapshot,
): Promise<Reconciliation> {
  const payment = sub.latest_invoice
    ? await invoicePayment(providerId(sub.latest_invoice), sub)
    : undefined;
  return {
    subscriptions: [subscriptionState(sub)],
    payments: payment ? [payment.payment] : [],
  };
}
async function reconcileSession(
  id: string,
  snapshot?: Session,
): Promise<Reconciliation> {
  const session =
    snapshot ?? (await api<Session>(`checkout/sessions/${providerId(id)}`));
  check(session.id === id);
  const identity = owner(session.metadata);
  check(session.client_reference_id === identity.orderId);
  if (session.status === "expired")
    return { expiredOrderIds: [identity.orderId] };
  if (session.status !== "complete" || session.payment_status !== "paid")
    return {};
  if (session.mode === "subscription") {
    const sub = await readSubscription(providerId(session.subscription));
    sameOwner(session.metadata, sub.metadata);
    return reconcileSubscription(sub);
  }
  check(session.mode === "payment");
  const { intent, charge } = await receipt(
    providerId(session.payment_intent),
    session.amount_total,
    session.currency,
  );
  sameOwner(session.metadata, intent.metadata);
  check(!charge.invoice);
  return {
    payments: [
      {
        ...identity,
        paymentId: intent.id,
        amount: session.amount_total,
        currency: "USD",
      },
    ],
  };
}
async function reconcileRefund(id: string): Promise<Reconciliation> {
  const refund = await api<Refund>(`refunds/${providerId(id)}`);
  check(refund.id === id);
  if (refund.status !== "succeeded") return {};
  money(refund.amount, refund.currency);
  const charge = await api<Charge>(`charges/${providerId(refund.charge)}`);
  check(
    charge.id === providerId(refund.charge) &&
      providerId(charge.payment_intent) === providerId(refund.payment_intent),
  );
  check(
    charge.paid &&
      charge.status === "succeeded" &&
      charge.currency === refund.currency &&
      refund.amount <= charge.amount,
  );
  let paymentId = providerId(charge.payment_intent);
  if (charge.invoice) {
    const payment = await invoicePayment(providerId(charge.invoice));
    check(payment && payment.payment.amount === charge.amount);
    paymentId = payment.payment.paymentId;
  } else {
    const { intent, charge: verifiedCharge } = await receipt(
      paymentId,
      charge.amount,
      charge.currency,
    );
    owner(intent.metadata);
    check(verifiedCharge.id === charge.id);
  }
  return {
    refunds: [
      {
        refundId: refund.id,
        paymentId,
        amount: refund.amount,
        currency: "USD",
      },
    ],
  };
}
function signature(raw: string, header: string | null) {
  const parts = (header ?? "").split(",").map((p) => p.trim().split("="));
  const times = parts.filter(([key]) => key === "t");
  const time = times[0]?.[1];
  if (
    times.length !== 1 ||
    !time ||
    !/^\d+$/.test(time) ||
    Math.abs(Date.now() / 1000 - Number(time)) > 300
  )
    throw new HttpError(401, "签名无效或通知已过期。");
  const expected = createHmac(
    "sha256",
    required(bindings().STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET"),
  )
    .update(`${time}.${raw}`)
    .digest();
  const valid = parts.some(
    ([key, value]) =>
      key === "v1" &&
      /^[a-f\d]{64}$/i.test(value ?? "") &&
      timingSafeEqual(expected, Buffer.from(value, "hex")),
  );
  if (!valid) throw new HttpError(401, "签名无效。");
}
async function validatePrice(input: CheckoutInput) {
  if (!input.productRef) return;
  const price = await api<{
    id: string;
    active: boolean;
    currency: string;
    unit_amount: number;
    type: string;
    billing_scheme: string;
    recurring?: {
      interval: string;
      interval_count: number;
      usage_type: string;
    };
    custom_unit_amount?: unknown;
    transform_quantity?: unknown;
  }>(`prices/${providerId(input.productRef)}`);
  check(
    price.id === input.productRef &&
      price.active &&
      price.currency === "usd" &&
      price.unit_amount === input.amount &&
      price.billing_scheme === "per_unit" &&
      !price.custom_unit_amount &&
      !price.transform_quantity,
  );
  check(
    input.mode === "subscription"
      ? price.type === "recurring" &&
          price.recurring?.interval === (input.interval || "month") &&
          price.recurring?.interval_count === 1 &&
          price.recurring?.usage_type === "licensed"
      : price.type === "one_time" && !price.recurring,
  );
}
export const stripeProvider: IntegratedPaymentProvider = {
  id: "stripe",
  validateCheckout: validatePrice,
  async createCheckout(input) {
    await validatePrice(input);
    money(input.amount, "usd");
    owner(input);
    const url = new URL("/billing", bindings().APP_URL).href;
    const form = new URLSearchParams({
      mode: input.mode,
      success_url: url,
      cancel_url: url,
      customer_email: input.email,
      client_reference_id: input.orderId,
      "metadata[orderId]": input.orderId,
      "metadata[userId]": input.userId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(input.amount),
      "line_items[0][price_data][product_data][name]": input.name,
    });
    const prefix =
      input.mode === "subscription"
        ? "subscription_data"
        : "payment_intent_data";
    form.set(`${prefix}[metadata][orderId]`, input.orderId);
    form.set(`${prefix}[metadata][userId]`, input.userId);
    if (input.productRef) {
      form.delete("line_items[0][price_data][currency]");
      form.delete("line_items[0][price_data][unit_amount]");
      form.delete("line_items[0][price_data][product_data][name]");
      form.set("line_items[0][price]", input.productRef);
    } else if (input.mode === "subscription") {
      form.set(
        "line_items[0][price_data][recurring][interval]",
        input.interval || "month",
      );
    }
    const session = await api<Session>(
      "checkout/sessions",
      form,
      `checkout-${input.orderId}`,
    );
    const checkout = checkoutUrl(session.url);
    check(new URL(checkout).hostname === "checkout.stripe.com");
    return { providerId: providerId(session), url: checkout };
  },
  async syncCheckout(input: CheckoutRecoveryInput) {
    const session = await api<Session>(
      `checkout/sessions/${providerId(input.providerId)}`,
    );
    check(session.id === input.providerId);
    const who = owner(session.metadata);
    check(
      who.orderId === input.orderId &&
        who.userId === input.userId &&
        session.client_reference_id === input.orderId &&
        session.mode === input.mode,
    );
    check(
      session.amount_total === input.amount &&
        session.currency.toUpperCase() === input.currency,
    );
    let url: string | null = null;
    if (session.status === "open" && session.url) {
      url = checkoutUrl(session.url);
      check(new URL(url).hostname === "checkout.stripe.com");
    }
    return { reconciliation: await reconcileSession(session.id, session), url };
  },
  async cancelSubscription(id) {
    await api(
      `subscriptions/${providerId(id)}`,
      new URLSearchParams({ cancel_at_period_end: "true" }),
    );
  },
  async syncSubscription(id) {
    return reconcileSubscription(await readSubscription(id));
  },
  async handleWebhook(request) {
    const raw = await rawWebhook(request);
    signature(raw, request.headers.get("stripe-signature"));
    let event: { type: string; data: { object: { id: string } } };
    try {
      event = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "通知格式错误。");
    }
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.expired":
        return reconcileSession(providerId(event.data.object));
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const payment = await invoicePayment(providerId(event.data.object));
        return payment
          ? {
              payments: [payment.payment],
              subscriptions: [payment.subscription],
            }
          : { payments: [] };
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return reconcileSubscription(
          await readSubscription(providerId(event.data.object)),
        );
      case "refund.created":
      case "refund.updated":
        return reconcileRefund(providerId(event.data.object));
      default:
        return {};
    }
  },
};
