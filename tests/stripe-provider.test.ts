import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => ({
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    APP_URL: "https://example.test",
  }),
  required: (value: string | undefined) => {
    if (!value) throw new Error("Missing config");
    return value;
  },
}));
import { stripeProvider } from "../src/modules/billing/server/providers/stripe";
const metadata = { orderId: "order_1", userId: "user_1" };
const sub = {
  id: "sub_1",
  metadata,
  customer: "cus_1",
  status: "active",
  latest_invoice: "in_1",
};
const invoice = {
  id: "in_1",
  subscription: "sub_1",
  customer: "cus_1",
  payment_intent: "pi_1",
  charge: "ch_1",
  status: "paid",
  paid: true,
  paid_out_of_band: false,
  amount_paid: 1900,
  amount_due: 1900,
  total: 1900,
  currency: "usd",
  billing_reason: "subscription_create",
  lines: {
    has_more: false,
    data: [
      {
        type: "subscription",
        subscription: "sub_1",
        proration: false,
        period: { end: 1800000000 },
      },
    ],
  },
};
const intent = {
  id: "pi_1",
  metadata,
  customer: "cus_1",
  status: "succeeded",
  amount_received: 1900,
  currency: "usd",
  latest_charge: "ch_1",
};
const charge = {
  id: "ch_1",
  payment_intent: "pi_1",
  invoice: "in_1",
  amount: 1900,
  currency: "usd",
  paid: true,
  status: "succeeded",
  customer: "cus_1",
};
const session = {
  id: "cs_1",
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  metadata,
  client_reference_id: "order_1",
  amount_total: 1900,
  currency: "usd",
  subscription: "sub_1",
};
let responses: Record<string, unknown>;
let calls: ReturnType<typeof vi.fn>;
function request(
  type: string,
  id: string,
  seconds = Math.floor(Date.now() / 1000),
  alter?: string,
) {
  const raw = JSON.stringify({
    type,
    data: {
      object: {
        id,
        metadata: { orderId: "forged", userId: "forged" },
        amount_paid: 999999,
      },
    },
  });
  const sig = createHmac("sha256", "whsec_fixture")
    .update(`${seconds}.${raw}`)
    .digest("hex");
  return new Request("https://example.test/api/webhooks/stripe", {
    method: "POST",
    body: raw + (alter ?? ""),
    headers: { "stripe-signature": `t=${seconds},v1=${sig}` },
  });
}
beforeEach(() => {
  responses = structuredClone({
    "subscriptions/sub_1": sub,
    "invoices/in_1": invoice,
    "payment_intents/pi_1": intent,
    "charges/ch_1": charge,
    "checkout/sessions/cs_1": session,
  });
  calls = vi.fn(async (url: string, init: RequestInit) => {
    expect((init.headers as Record<string, string>)["Stripe-Version"]).toBe(
      "2024-06-20",
    );
    const value = responses[url.replace("https://api.stripe.com/v1/", "")];
    if (!value) return new Response("private provider error", { status: 404 });
    return Response.json(value);
  });
  vi.stubGlobal("fetch", calls);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Stripe verified payment reconciliation", () => {
  it("rejects altered, old, and future signed bodies before any API access", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1792116000000);
    for (const req of [
      request("invoice.paid", "in_1", undefined, " "),
      request("invoice.paid", "in_1", Math.floor(Date.now() / 1000) - 301),
      request("invoice.paid", "in_1", Math.floor(Date.now() / 1000) + 301),
    ]) {
      await expect(stripeProvider.handleWebhook(req)).rejects.toMatchObject({
        status: 401,
      });
    }
    expect(calls).not.toHaveBeenCalled();
  });
  it("uses queried identities and amounts; checkout, retry and invoice events share one receipt", async () => {
    const checkout = await stripeProvider.handleWebhook(
      request("checkout.session.completed", "cs_1"),
    );
    const paid = await stripeProvider.handleWebhook(
      request("invoice.paid", "in_1"),
    );
    const repeated = await stripeProvider.handleWebhook(
      request("invoice.payment_succeeded", "in_1"),
    );
    expect(checkout.payments).toEqual(paid.payments);
    expect(repeated.payments).toEqual(paid.payments);
    expect(paid.payments).toEqual([
      {
        ...metadata,
        paymentId: "in_1",
        subscriptionId: "sub_1",
        amount: 1900,
        currency: "USD",
        coveredUntil: 1800000000000,
      },
    ]);
  });
  it("does not grant for a fake settled invoice without a matching actual payment", async () => {
    responses["payment_intents/pi_1"] = { ...intent, amount_received: 100 };
    await expect(
      stripeProvider.handleWebhook(request("invoice.paid", "in_1")),
    ).rejects.toThrow("Stripe verification failed");
  });
  it("includes a subscription snapshot when the first delivery is only invoice.paid", async () => {
    const result = await stripeProvider.handleWebhook(
      request("invoice.paid", "in_1"),
    );
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions?.[0]).toMatchObject({
      ...metadata,
      subscriptionId: "sub_1",
      status: "ACTIVE",
    });
    expect(result.payments?.[0].subscriptionId).toBe(
      result.subscriptions?.[0].subscriptionId,
    );
    expect(
      calls.mock.calls.filter(([url]) => url.endsWith("/subscriptions/sub_1")),
    ).toHaveLength(1);
  });
  it("marks scheduled cancellation as stopped renewal while preserving the paid period", async () => {
    responses["subscriptions/sub_1"] = {
      ...sub,
      status: "active",
      cancel_at_period_end: true,
    };
    const result = await stripeProvider.syncSubscription("sub_1");
    expect(result.subscriptions?.[0].status).toBe("CANCELED");
    expect(result.payments?.[0]).toMatchObject({
      paymentId: "in_1",
      coveredUntil: 1800000000000,
    });
  });
  it("timestamps subscription snapshots before the provider request, not after a slow response", async () => {
    let now = 1000000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    calls.mockImplementationOnce(async () => {
      now = 2000000;
      return Response.json(sub);
    });
    const result = await stripeProvider.syncSubscription("sub_1");
    expect(result.subscriptions?.[0].updatedAt).toBe(1000000);
  });
  it("rejects checkout/subscription ownership mismatch", async () => {
    responses["subscriptions/sub_1"] = {
      ...sub,
      metadata: { ...metadata, userId: "other_user" },
    };
    await expect(
      stripeProvider.handleWebhook(
        request("checkout.session.completed", "cs_1"),
      ),
    ).rejects.toThrow("Stripe verification failed");
  });
  it("ignores pending payments and non-cycle proration invoices", async () => {
    responses["invoices/in_1"] = { ...invoice, status: "open", paid: false };
    expect(
      await stripeProvider.handleWebhook(request("invoice.paid", "in_1")),
    ).toEqual({ payments: [] });
    responses["invoices/in_1"] = {
      ...invoice,
      billing_reason: "subscription_update",
    };
    expect(
      await stripeProvider.handleWebhook(request("invoice.paid", "in_1")),
    ).toEqual({ payments: [] });
  });
  it("gives renewal invoices their own receipt and maps refunds back to that invoice", async () => {
    responses["invoices/in_2"] = {
      ...invoice,
      id: "in_2",
      payment_intent: "pi_2",
      charge: "ch_2",
      billing_reason: "subscription_cycle",
    };
    responses["payment_intents/pi_2"] = {
      ...intent,
      id: "pi_2",
      latest_charge: "ch_2",
    };
    responses["charges/ch_2"] = {
      ...charge,
      id: "ch_2",
      invoice: "in_2",
      payment_intent: "pi_2",
    };
    responses["refunds/re_2"] = {
      id: "re_2",
      charge: "ch_2",
      payment_intent: "pi_2",
      status: "succeeded",
      amount: 500,
      currency: "usd",
    };
    const initial = await stripeProvider.handleWebhook(
      request("invoice.paid", "in_1"),
    );
    const renewal = await stripeProvider.handleWebhook(
      request("invoice.paid", "in_2"),
    );
    expect(initial.payments?.[0].paymentId).toBe("in_1");
    expect(renewal.payments?.[0].paymentId).toBe("in_2");
    expect(
      await stripeProvider.handleWebhook(request("refund.created", "re_2")),
    ).toEqual({
      refunds: [
        { refundId: "re_2", paymentId: "in_2", amount: 500, currency: "USD" },
      ],
    });
  });
  it("rejects a receipt for another customer or currency", async () => {
    responses["payment_intents/pi_1"] = { ...intent, customer: "cus_other" };
    await expect(
      stripeProvider.handleWebhook(request("invoice.paid", "in_1")),
    ).rejects.toThrow("Stripe verification failed");
    responses["payment_intents/pi_1"] = intent;
    responses["invoices/in_1"] = { ...invoice, currency: "eur" };
    await expect(
      stripeProvider.handleWebhook(request("invoice.paid", "in_1")),
    ).rejects.toThrow("Stripe verification failed");
  });
  it("uses current subscription state even if the signed event is an older update", async () => {
    responses["subscriptions/sub_1"] = { ...sub, status: "canceled" };
    const result = await stripeProvider.handleWebhook(
      request("customer.subscription.updated", "sub_1"),
    );
    expect(result.subscriptions?.[0]).toMatchObject({
      ...metadata,
      subscriptionId: "sub_1",
      status: "CANCELED",
    });
  });
  it("uses the payment intent as one-time payment and refund identity", async () => {
    responses["checkout/sessions/cs_1"] = {
      ...session,
      mode: "payment",
      payment_intent: "pi_1",
    };
    responses["charges/ch_1"] = { ...charge, invoice: null };
    responses["refunds/re_1"] = {
      id: "re_1",
      charge: "ch_1",
      payment_intent: "pi_1",
      status: "succeeded",
      amount: 1900,
      currency: "usd",
    };
    expect(
      (
        await stripeProvider.handleWebhook(
          request("checkout.session.completed", "cs_1"),
        )
      ).payments?.[0].paymentId,
    ).toBe("pi_1");
    expect(
      (await stripeProvider.handleWebhook(request("refund.updated", "re_1")))
        .refunds?.[0].paymentId,
    ).toBe("pi_1");
  });
  it("creates monthly price data and metadata using the server amount with idempotency", async () => {
    responses["checkout/sessions"] = {
      id: "cs_new",
      url: "https://checkout.stripe.com/c/pay/test",
    };
    await stripeProvider.createCheckout({
      ...metadata,
      planId: "creator",
      amount: 1900,
      credits: 500,
      email: "test@example.test",
      name: "Creator",
      mode: "subscription",
    });
    const init = calls.mock.calls[0][1] as RequestInit;
    const form = new URLSearchParams(init.body as string);
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("1900");
    expect(form.get("line_items[0][price_data][recurring][interval]")).toBe(
      "month",
    );
    expect(form.get("subscription_data[metadata][userId]")).toBe("user_1");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "checkout-order_1",
    );
  });
  it("cancels future renewals and only expires a queried expired session", async () => {
    await stripeProvider.cancelSubscription("sub_1");
    expect(
      new URLSearchParams(calls.mock.calls[0][1].body).get(
        "cancel_at_period_end",
      ),
    ).toBe("true");
    responses["checkout/sessions/cs_1"] = { ...session, status: "expired" };
    expect(
      await stripeProvider.handleWebhook(
        request("checkout.session.expired", "cs_1"),
      ),
    ).toEqual({ expiredOrderIds: ["order_1"] });
  });
  it("ignores unknown signed events and hides upstream error contents", async () => {
    expect(
      await stripeProvider.handleWebhook(request("unknown", "obj_1")),
    ).toEqual({});
    await expect(
      stripeProvider.syncSubscription("sub_missing"),
    ).rejects.toThrow("Payment provider request failed");
  });
});

describe("Stripe owned checkout recovery", () => {
  const recovery = {
    ...metadata,
    providerId: "cs_1",
    amount: 1900,
    currency: "USD",
    mode: "subscription" as const,
  };
  it("reuses verified invoice receipt identity for a missed first-payment webhook", async () => {
    const result = await stripeProvider.syncCheckout(recovery);
    expect(result.reconciliation.payments?.[0]).toMatchObject({
      ...metadata,
      paymentId: "in_1",
      amount: 1900,
    });
    expect(result.url).toBeNull();
  });
  it("clears only an owned expired checkout without minting credits", async () => {
    responses["checkout/sessions/cs_1"] = {
      ...session,
      status: "expired",
      payment_status: "unpaid",
    };
    expect(await stripeProvider.syncCheckout(recovery)).toEqual({
      reconciliation: { expiredOrderIds: [metadata.orderId] },
      url: null,
    });
  });
  it("rejects mismatched identities even for unpaid/expired checkouts", async () => {
    responses["checkout/sessions/cs_1"] = {
      ...session,
      status: "expired",
      metadata: { ...metadata, userId: "other" },
    };
    await expect(stripeProvider.syncCheckout(recovery)).rejects.toThrow(
      "verification failed",
    );
  });
});

it("binds a custom annual Stripe Price and rejects mismatched billing intervals", async () => {
  responses["prices/price_year"] = {
    id: "price_year",
    active: true,
    currency: "usd",
    unit_amount: 19900,
    type: "recurring",
    billing_scheme: "per_unit",
    recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
  };
  responses["checkout/sessions"] = {
    id: "cs_year",
    url: "https://checkout.stripe.com/c/pay/year",
  };
  const input = {
    ...metadata,
    planId: "custom_year",
    productRef: "price_year",
    interval: "year" as const,
    amount: 19900,
    credits: 800,
    email: "test@example.test",
    name: "Year",
    mode: "subscription" as const,
  };
  await stripeProvider.createCheckout(input);
  const form = new URLSearchParams(calls.mock.calls.at(-1)![1].body);
  expect(form.get("line_items[0][price]")).toBe("price_year");
  expect(form.has("line_items[0][price_data][unit_amount]")).toBe(false);
  await expect(
    stripeProvider.validateCheckout!({ ...input, interval: "month" }),
  ).rejects.toThrow();
});
