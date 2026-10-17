import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ first: vi.fn(), bind: vi.fn() }));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("cloudflare:workers", () => ({
  env: {
    DB: {
      prepare: () => ({
        bind: (...values: unknown[]) => {
          database.bind(...values);
          return { first: database.first };
        },
      }),
    },
    APP_URL: "https://app.example",
    PAYPAL_CLIENT_ID: "fixture-client",
    PAYPAL_CLIENT_SECRET: "fixture-secret",
    PAYPAL_WEBHOOK_ID: "WH-CONFIG",
    PAYPAL_ENVIRONMENT: "sandbox",
    PAYPAL_CREATOR_PLAN_ID: "P-PLAN",
  },
}));
import { paypalProvider } from "../src/modules/billing/server/providers/paypal";

const input = {
  orderId: "local-order",
  userId: "local-user",
  email: "test@example.test",
  planId: "pack",
  amount: 900,
  credits: 200,
  mode: "payment" as const,
  name: "Credits",
};
const meta = JSON.stringify([input.orderId, input.userId]);
const usd = (value = "9.00") => ({ value, currency_code: "USD" });
const cap = () => ({
  id: "CAPTURE-1",
  status: "COMPLETED",
  amount: usd(),
  supplementary_data: { related_ids: { order_id: "ORDER-1" } },
});
const order = (status = "COMPLETED") => ({
  id: "ORDER-1",
  status,
  purchase_units: [
    {
      custom_id: meta,
      invoice_id: input.orderId,
      amount: usd(),
      payments: { captures: [cap()] },
    },
  ],
});
const plan = () => ({
  id: "P-PLAN",
  status: "ACTIVE",
  billing_cycles: [
    {
      tenure_type: "REGULAR",
      frequency: { interval_unit: "MONTH", interval_count: 1 },
      total_cycles: 0,
      pricing_scheme: { fixed_price: usd("19.00") },
    },
  ],
  payment_preferences: { auto_bill_outstanding: false, setup_fee: usd("0.00") },
});
const sub = () => ({
  id: "I-SUB",
  plan_id: "P-PLAN",
  custom_id: meta,
  status: "ACTIVE",
  create_time: "2026-08-15T10:00:00Z",
  status_update_time: "2026-10-15T10:00:00Z",
  quantity: "1",
  plan_overridden: false,
  plan: plan(),
  billing_info: {
    last_payment: { time: "2026-10-15T10:00:00Z", amount: usd("19.00") },
    next_billing_time: "2026-11-15T10:00:00Z",
  },
});
const tx = (id = "SALE-1", time = "2026-10-15T10:00:00Z") => ({
  id,
  status: "COMPLETED",
  time,
  amount_with_breakdown: { gross_amount: usd("19.00") },
});
const sale = () => ({
  id: "SALE-1",
  state: "completed",
  amount: { total: "19.00", currency: "USD" },
  billing_agreement_id: "I-SUB",
  create_time: "2026-10-15T10:00:00Z",
});
function webhook(type: string, resource: object = { id: "CAPTURE-1" }) {
  return new Request("https://app.example/api/webhooks/paypal", {
    method: "POST",
    headers: {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT",
      "paypal-transmission-id": "TRANSMISSION-1",
      "paypal-transmission-sig": "original-signature",
      "paypal-transmission-time": "2026-10-15T10:00:01Z",
    },
    body: JSON.stringify({ id: "WH-EVENT", event_type: type, resource }),
  });
}
type Call = { url: URL; init: RequestInit; body: Record<string, unknown> };
let calls: Call[];
function mockApi(handler: (call: Call) => unknown, verified = "SUCCESS") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      expect(new URL(url).origin).toBe("https://api-m.sandbox.paypal.com");
      expect(init.redirect).toBe("error");
      const call = {
        url: new URL(url),
        init,
        body:
          init.body &&
          init.headers &&
          new Headers(init.headers).get("Content-Type") === "application/json"
            ? JSON.parse(String(init.body))
            : {},
      };
      calls.push(call);
      let result: unknown;
      if (call.url.pathname === "/v1/oauth2/token")
        result = { access_token: "fixture-access-token" };
      else if (
        call.url.pathname === "/v1/notifications/verify-webhook-signature"
      )
        result = { verification_status: verified };
      else result = handler(call);
      if (result === undefined) return new Response(null, { status: 204 });
      return Response.json(result);
    }),
  );
}
beforeEach(() => {
  calls = [];
  database.bind.mockClear();
  database.first.mockReset().mockResolvedValue({
    user_id: "local-user",
    provider: "paypal",
    provider_id: "ORDER-1",
    amount: 900,
    currency: "USD",
    status: "pending",
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PayPal server adapter", () => {
  it("passes original PayPal signature fields and entire event to remote verification before fetching payment", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/captures/") ? cap() : order(),
    );
    const result = await paypalProvider.handleWebhook(
      webhook("PAYMENT.CAPTURE.COMPLETED", {
        id: "CAPTURE-1",
        amount: usd("99999.00"),
        custom_id: "forged",
      }),
    );
    expect(result.payments).toEqual([
      {
        orderId: input.orderId,
        userId: input.userId,
        paymentId: "CAPTURE-1",
        amount: 900,
        currency: "USD",
      },
    ]);
    expect(calls[1].body).toMatchObject({
      auth_algo: "SHA256withRSA",
      cert_url: "https://api.paypal.com/v1/notifications/certs/CERT",
      transmission_id: "TRANSMISSION-1",
      transmission_sig: "original-signature",
      transmission_time: "2026-10-15T10:00:01Z",
      webhook_id: "WH-CONFIG",
      webhook_event: { id: "WH-EVENT", resource: { amount: usd("99999.00") } },
    });
    expect(calls[2].url.pathname).toBe("/v2/payments/captures/CAPTURE-1");
  });
  it("rejects failed or missing signatures without reading financial objects", async () => {
    mockApi(() => {
      throw new Error("Must not read payment");
    }, "FAILURE");
    await expect(
      paypalProvider.handleWebhook(webhook("PAYMENT.CAPTURE.COMPLETED")),
    ).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(2);
    const request = webhook("PAYMENT.CAPTURE.COMPLETED");
    request.headers.delete("paypal-transmission-id");
    await expect(paypalProvider.handleWebhook(request)).rejects.toMatchObject({
      status: 401,
    });
    expect(calls).toHaveLength(2);
  });
  it("rejects capture IDs that are not in the authoritative order", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/captures/")
        ? cap()
        : {
            ...order(),
            purchase_units: [
              {
                ...order().purchase_units[0],
                payments: { captures: [{ ...cap(), id: "OTHER-CAPTURE" }] },
              },
            ],
          },
    );
    await expect(
      paypalProvider.handleWebhook(webhook("PAYMENT.CAPTURE.COMPLETED")),
    ).rejects.toThrow("capture/order mismatch");
  });
  it("rejects inconsistent invoice identity or currency and never grants pending payments", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/captures/")
        ? cap()
        : {
            ...order(),
            purchase_units: [
              { ...order().purchase_units[0], invoice_id: "some-other-order" },
            ],
          },
    );
    await expect(
      paypalProvider.handleWebhook(webhook("PAYMENT.CAPTURE.COMPLETED")),
    ).rejects.toThrow("invoice mismatch");
    mockApi(({ url }) =>
      url.pathname.includes("/captures/") ? cap() : order("APPROVED"),
    );
    expect(
      await paypalProvider.handleWebhook(webhook("PAYMENT.CAPTURE.COMPLETED")),
    ).toEqual({ payments: [] });
    mockApi(({ url }) =>
      url.pathname.includes("/captures/")
        ? cap()
        : {
            ...order(),
            purchase_units: [
              {
                ...order().purchase_units[0],
                amount: { value: "9.00", currency_code: "EUR" },
              },
            ],
          },
    );
    await expect(
      paypalProvider.handleWebhook(webhook("PAYMENT.CAPTURE.COMPLETED")),
    ).rejects.toThrow("currency");
  });
  it("captures an approved order with stable idempotency and uses the same payment identity as capture events", async () => {
    let read = 0;
    mockApi(({ url }) =>
      url.pathname.endsWith("/capture")
        ? order()
        : order(++read % 2 === 1 ? "APPROVED" : "COMPLETED"),
    );
    const first = await paypalProvider.handleWebhook(
      webhook("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }),
    );
    const second = await paypalProvider.handleWebhook(
      webhook("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }),
    );
    expect(first).toEqual(second);
    expect(first.payments?.[0].paymentId).toBe("CAPTURE-1");
    const captures = calls.filter((call) =>
      call.url.pathname.endsWith("/capture"),
    );
    expect(captures).toHaveLength(2);
    expect(
      new Headers(captures[0].init.headers).get("PayPal-Request-Id"),
    ).toEqual(new Headers(captures[1].init.headers).get("PayPal-Request-Id"));
  });
  it("does not capture an unknown checkout, wrong owner, channel, or changed amount", async () => {
    mockApi(({ url }) => {
      if (url.pathname.endsWith("/capture"))
        throw new Error("Must not capture");
      return order("APPROVED");
    });
    for (const local of [
      null,
      {
        user_id: "other-user",
        provider: "paypal",
        amount: 900,
        currency: "USD",
        status: "pending",
      },
      {
        user_id: "local-user",
        provider: "stripe",
        amount: 900,
        currency: "USD",
        status: "pending",
      },
      {
        user_id: "local-user",
        provider: "paypal",
        amount: 1900,
        currency: "USD",
        status: "pending",
      },
    ]) {
      database.first.mockResolvedValueOnce(local);
      await expect(
        paypalProvider.handleWebhook(
          webhook("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }),
        ),
      ).rejects.toThrow("does not match local checkout");
    }
    expect(database.bind).toHaveBeenCalledWith("local-order");
    expect(calls.some((call) => call.url.pathname.endsWith("/capture"))).toBe(
      false,
    );
  });
  it("reads historical subscription plans and prices after configured products change", async () => {
    const previous = {
      ...sub(),
      plan_id: "P-OLD",
      plan: {
        ...plan(),
        id: "P-OLD",
        billing_cycles: [
          {
            ...plan().billing_cycles[0],
            pricing_scheme: { fixed_price: usd("12.00") },
          },
        ],
      },
      billing_info: {
        last_payment: { time: tx().time, amount: usd("12.00") },
        next_billing_time: sub().billing_info.next_billing_time,
      },
    };
    mockApi(({ url }) =>
      url.pathname.includes("/sale/")
        ? { ...sale(), amount: { total: "12.00", currency: "USD" } }
        : url.pathname.endsWith("/transactions")
          ? {
              transactions: [
                {
                  ...tx(),
                  amount_with_breakdown: { gross_amount: usd("12.00") },
                },
              ],
            }
          : previous,
    );
    const result = await paypalProvider.handleWebhook(
      webhook("PAYMENT.SALE.COMPLETED", { id: "SALE-1" }),
    );
    expect(result.payments?.[0]).toMatchObject({
      amount: 1200,
      subscriptionId: "I-SUB",
    });
    // The shared engine compares this amount against the immutable local order.
  });
  it("creates server-owned amount and metadata with a stable checkout request id", async () => {
    mockApi(() => ({
      id: "ORDER-1",
      links: [
        {
          rel: "payer-action",
          href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1",
        },
      ],
    }));
    await paypalProvider.createCheckout(input);
    await paypalProvider.createCheckout(input);
    const orders = calls.filter(
      (call) => call.url.pathname === "/v2/checkout/orders",
    );
    expect(orders[0].body).toMatchObject({
      intent: "CAPTURE",
      purchase_units: [
        { invoice_id: input.orderId, custom_id: meta, amount: usd() },
      ],
    });
    expect(
      new Headers(orders[0].init.headers).get("PayPal-Request-Id"),
    ).toEqual(new Headers(orders[1].init.headers).get("PayPal-Request-Id"));
    expect(new Headers(orders[0].init.headers).get("Authorization")).toBe(
      "Bearer fixture-access-token",
    );
  });
  it("validates the monthly plan before checkout and returns its subscription identity", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/plans/")
        ? plan()
        : {
            id: "I-SUB",
            links: [
              {
                rel: "approve",
                href: "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-1",
              },
            ],
          },
    );
    const result = await paypalProvider.createCheckout({
      ...input,
      mode: "subscription",
      amount: 1900,
      planId: "creator",
    });
    expect(result).toMatchObject({
      providerId: "I-SUB",
      subscriptionId: "I-SUB",
    });
    mockApi(({ url }) => {
      if (url.pathname.includes("/plans/"))
        return {
          ...plan(),
          payment_preferences: {
            auto_bill_outstanding: false,
            setup_fee: usd("1.00"),
          },
        };
      throw new Error("Must not create subscription");
    });
    await expect(
      paypalProvider.createCheckout({
        ...input,
        mode: "subscription",
        planId: "creator",
        amount: 1900,
      }),
    ).rejects.toThrow("fixed USD monthly or yearly plan");
  });
  it("checks sale membership and confirmed amount, and uses the current paid billing period", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/sale/")
        ? sale()
        : url.pathname.endsWith("/transactions")
          ? { transactions: [tx()] }
          : sub(),
    );
    const result = await paypalProvider.handleWebhook(
      webhook("PAYMENT.SALE.COMPLETED", { id: "SALE-1" }),
    );
    expect(result.payments).toEqual([
      {
        orderId: input.orderId,
        userId: input.userId,
        paymentId: "SALE-1",
        amount: 1900,
        currency: "USD",
        subscriptionId: "I-SUB",
        coveredUntil: Date.parse("2026-11-15T10:00:00Z"),
        coveredFrom: Date.parse("2026-10-15T10:00:00Z"),
      },
    ]);
    mockApi(({ url }) =>
      url.pathname.includes("/sale/")
        ? sale()
        : url.pathname.endsWith("/transactions")
          ? { transactions: [tx("OTHER-SALE")] }
          : sub(),
    );
    await expect(
      paypalProvider.handleWebhook(
        webhook("PAYMENT.SALE.COMPLETED", { id: "SALE-1" }),
      ),
    ).rejects.toThrow("not found in subscription transactions");
  });
  it("does not assign a newer billing period to an old payment, or extend implausible periods", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/sale/")
        ? sale()
        : url.pathname.endsWith("/transactions")
          ? { transactions: [tx()] }
          : {
              ...sub(),
              billing_info: {
                last_payment: {
                  time: "2026-11-15T10:00:00Z",
                  amount: usd("19.00"),
                },
                next_billing_time: "2026-12-15T10:00:00Z",
              },
            },
    );
    expect(
      (
        await paypalProvider.handleWebhook(
          webhook("PAYMENT.SALE.COMPLETED", { id: "SALE-1" }),
        )
      ).payments?.[0],
    ).not.toHaveProperty("coveredUntil");
    mockApi(({ url }) =>
      url.pathname.includes("/sale/")
        ? sale()
        : url.pathname.endsWith("/transactions")
          ? { transactions: [tx()] }
          : {
              ...sub(),
              billing_info: {
                ...sub().billing_info,
                next_billing_time: "2028-10-15T10:00:00Z",
              },
            },
    );
    expect(
      (
        await paypalProvider.handleWebhook(
          webhook("PAYMENT.SALE.COMPLETED", { id: "SALE-1" }),
        )
      ).payments?.[0],
    ).not.toHaveProperty("coveredUntil");
  });
  it("never grants known-refunded transactions from stale completion events or subscription sync", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/sale/")
        ? { ...sale(), state: "refunded" }
        : url.pathname.endsWith("/transactions")
          ? { transactions: [{ ...tx(), status: "REFUNDED" }] }
          : sub(),
    );
    expect(
      await paypalProvider.handleWebhook(
        webhook("PAYMENT.SALE.COMPLETED", { id: "SALE-1" }),
      ),
    ).toEqual({});
    expect((await paypalProvider.syncSubscription("I-SUB")).payments).toEqual(
      [],
    );
    mockApi(({ url }) =>
      url.pathname.includes("/captures/")
        ? { ...cap(), status: "REFUNDED" }
        : {
            ...order(),
            purchase_units: [
              {
                ...order().purchase_units[0],
                payments: { captures: [{ ...cap(), status: "REFUNDED" }] },
              },
            ],
          },
    );
    expect(
      (await paypalProvider.handleWebhook(webhook("PAYMENT.CAPTURE.COMPLETED")))
        .payments,
    ).toEqual([]);
  });
  it("reads current subscription status even when a lifecycle event is stale", async () => {
    mockApi(() => ({ ...sub(), status: "CANCELLED" }));
    const result = await paypalProvider.handleWebhook(
      webhook("BILLING.SUBSCRIPTION.ACTIVATED", {
        id: "I-SUB",
        status: "ACTIVE",
      }),
    );
    expect(result.subscriptions?.[0].status).toBe("CANCELED");
    expect(result.payments).toBeUndefined();
  });
  it("reads refund-to-capture association without fetching the provider link", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/refunds/")
        ? {
            id: "REFUND-1",
            status: "COMPLETED",
            amount: usd("4.00"),
            links: [
              {
                rel: "up",
                href: "https://api.paypal.com/v2/payments/captures/CAPTURE-1",
              },
            ],
          }
        : url.pathname.includes("/captures/")
          ? cap()
          : order(),
    );
    const result = await paypalProvider.handleWebhook(
      webhook("PAYMENT.CAPTURE.REFUNDED", {
        id: "REFUND-1",
        amount: usd("999.00"),
      }),
    );
    expect(result.refunds).toEqual([
      {
        refundId: "REFUND-1",
        paymentId: "CAPTURE-1",
        amount: 400,
        currency: "USD",
      },
    ]);
    mockApi(() => ({
      id: "REFUND-1",
      status: "COMPLETED",
      amount: usd(),
      links: [
        {
          rel: "up",
          href: "https://evil.example/v2/payments/captures/CAPTURE-1",
        },
      ],
    }));
    await expect(
      paypalProvider.handleWebhook(
        webhook("PAYMENT.CAPTURE.REFUNDED", { id: "REFUND-1" }),
      ),
    ).rejects.toThrow("Invalid PayPal resource link");
  });
  it("reconciles a subscription refund from the authenticated refund and original sale", async () => {
    mockApi(({ url }) =>
      url.pathname.includes("/refund/")
        ? {
            id: "REFUND-2",
            state: "completed",
            sale_id: "SALE-1",
            amount: { total: "19.00", currency: "USD" },
          }
        : url.pathname.includes("/sale/")
          ? { ...sale(), state: "refunded" }
          : url.pathname.endsWith("/transactions")
            ? { transactions: [{ ...tx(), status: "REFUNDED" }] }
            : sub(),
    );
    const result = await paypalProvider.handleWebhook(
      webhook("PAYMENT.SALE.REFUNDED", { id: "REFUND-2", sale_id: "FORGED" }),
    );
    expect(result.refunds).toEqual([
      {
        refundId: "REFUND-2",
        paymentId: "SALE-1",
        amount: 1900,
        currency: "USD",
      },
    ]);
    expect(result.payments?.[0].paymentId).toBe("SALE-1");
  });
});

describe("PayPal owned order recovery", () => {
  const recovery = {
    orderId: input.orderId,
    userId: input.userId,
    providerId: "ORDER-1",
    amount: 900,
    currency: "USD",
    mode: "payment" as const,
  };
  it("captures an already approved owned order then reads canonical payment evidence", async () => {
    let captured = false;
    mockApi(({ url, init }) => {
      if (url.pathname.endsWith("/capture")) {
        expect(init.method).toBe("POST");
        captured = true;
        return order();
      }
      if (url.pathname === "/v2/checkout/orders/ORDER-1")
        return order(captured ? "COMPLETED" : "APPROVED");
      throw new Error("Unexpected API call");
    });
    const result = await paypalProvider.syncCheckout(recovery);
    expect(result.reconciliation.payments).toEqual([
      {
        orderId: input.orderId,
        userId: input.userId,
        paymentId: "CAPTURE-1",
        amount: 900,
        currency: "USD",
      },
    ]);
    expect(captured).toBe(true);
  });
  it("does not capture a remotely mismatched owner", async () => {
    mockApi(() => ({
      ...order("APPROVED"),
      purchase_units: [
        {
          ...order().purchase_units[0],
          custom_id: JSON.stringify([input.orderId, "other"]),
        },
      ],
    }));
    await expect(paypalProvider.syncCheckout(recovery)).rejects.toThrow(
      "owner/amount mismatch",
    );
    expect(calls.some((c) => c.url.pathname.endsWith("/capture"))).toBe(false);
  });
  it("expires a provider-voided order without claiming paid", async () => {
    mockApi(() => order("VOIDED"));
    expect(await paypalProvider.syncCheckout(recovery)).toEqual({
      reconciliation: { payments: [], expiredOrderIds: [input.orderId] },
      url: null,
    });
  });
});

it("validates a custom annual PayPal plan and recognizes its paid year", async () => {
  const annual = {
    ...plan(),
    id: "P-YEAR",
    billing_cycles: plan().billing_cycles.map((c) => ({
      ...c,
      frequency: { interval_unit: "YEAR", interval_count: 1 },
    })),
  };
  mockApi(({ url }) => (url.pathname.includes("/plans/") ? annual : {}));
  await paypalProvider.validateCheckout!({
    ...input,
    planId: "custom_year",
    mode: "subscription",
    interval: "year",
    productRef: "P-YEAR",
    amount: 1900,
  });
  await expect(
    paypalProvider.validateCheckout!({
      ...input,
      planId: "custom_year",
      mode: "subscription",
      interval: "month",
      productRef: "P-YEAR",
      amount: 1900,
    }),
  ).rejects.toThrow("fixed USD");
  mockApi(({ url }) =>
    url.pathname.includes("/sale/")
      ? sale()
      : url.pathname.endsWith("/transactions")
        ? { transactions: [tx()] }
        : {
            ...sub(),
            plan: annual,
            plan_id: "P-YEAR",
            billing_info: {
              ...sub().billing_info,
              next_billing_time: "2027-10-15T10:00:00Z",
            },
          },
  );
  const result = await paypalProvider.handleWebhook(
    webhook("PAYMENT.SALE.COMPLETED", { id: "SALE-1" }),
  );
  expect(result.payments?.[0]).toMatchObject({
    coveredFrom: Date.parse("2026-10-15T10:00:00Z"),
    coveredUntil: Date.parse("2027-10-15T10:00:00Z"),
  });
});
