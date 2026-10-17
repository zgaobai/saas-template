import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => ({
    APP_URL: "https://app.example.test",
    CREEM_API_KEY: "fixture-key",
    CREEM_WEBHOOK_SECRET: "fixture-secret",
    CREEM_ENVIRONMENT: "test",
    CREEM_CREATOR_PRODUCT_ID: "prod_creator",
    CREEM_PACK_PRODUCT_ID: "prod_pack",
  }),
  required: (value: string | undefined) => {
    if (!value) throw new Error("Missing setting");
    return value;
  },
}));
import { creemProvider } from "@/modules/billing/server/providers/creem";

const owner = { orderId: "local_order", userId: "user_owner" };
const subscription = {
  id: "sub_1",
  status: "active",
  updated_at: "2026-10-01T00:00:00Z",
  customer: "cust_1",
  metadata: owner,
  last_transaction_id: "tran_newer",
};
const transaction = {
  id: "tran_1",
  status: "paid",
  amount: 1900,
  amount_paid: 1900,
  currency: "USD",
  customer: "cust_1",
  subscription: "sub_1",
  order: "ord_1",
  period_end: 1793491200000,
};
const checkout = {
  id: "ch_1",
  status: "completed",
  request_id: owner.orderId,
  metadata: owner,
  customer: "cust_1",
  order: { id: "ord_1", transaction: "tran_1", status: "paid" },
};
const fetchMock = vi.fn();
function respond(value: unknown) {
  fetchMock.mockResolvedValueOnce(Response.json(value));
}
function webhook(type: string, object: unknown, signature?: string) {
  const body = JSON.stringify({ id: "evt_1", eventType: type, object });
  return new Request("https://app.example.test/api/webhooks/creem", {
    method: "POST",
    body,
    headers: {
      "creem-signature":
        signature ??
        createHmac("sha256", "fixture-secret").update(body).digest("hex"),
    },
  });
}
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Creem authenticated reconciliation", () => {
  it("rejects forged signatures before reading provider data", async () => {
    await expect(
      creemProvider.handleWebhook(
        webhook("checkout.completed", { id: "ch_1" }, "0".repeat(64)),
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("takes identity, amount and currency only from API read-back", async () => {
    respond(checkout);
    respond({
      ...transaction,
      subscription: undefined,
      amount: 900,
      amount_paid: 900,
    });
    const result = await creemProvider.handleWebhook(
      webhook("checkout.completed", {
        id: "ch_1",
        metadata: { orderId: "forged", userId: "attacker" },
        order: { amount: 1, currency: "EUR" },
      }),
    );
    expect(result.payments).toEqual([
      { ...owner, paymentId: "tran_1", amount: 900, currency: "USD" },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://test-api.creem.io/v1/checkouts?checkout_id=ch_1",
    );
  });
  it("does not grant first subscription payment twice across checkout and paid events", async () => {
    respond({ ...checkout, subscription: "sub_1" });
    respond(subscription);
    const first = await creemProvider.handleWebhook(
      webhook("checkout.completed", { id: "ch_1" }),
    );
    expect(first.payments).toBeUndefined();
    respond(subscription);
    respond(transaction);
    const paid = await creemProvider.handleWebhook(
      webhook("subscription.paid", {
        id: "sub_1",
        last_transaction_id: "tran_1",
      }),
    );
    respond(subscription);
    respond(transaction);
    const retry = await creemProvider.handleWebhook(
      webhook("subscription.paid", {
        id: "sub_1",
        last_transaction_id: "tran_1",
      }),
    );
    expect(retry.payments).toEqual(paid.payments);
    expect(paid.payments?.[0]).toEqual({
      ...owner,
      paymentId: "tran_1",
      amount: 1900,
      currency: "USD",
      subscriptionId: "sub_1",
      coveredUntil: 1793491200000,
    });
    expect(fetchMock.mock.calls[3][0]).toContain("transaction_id=tran_1");
  });
  it("rejects a transaction linked to another subscription", async () => {
    respond(subscription);
    respond({ ...transaction, subscription: "sub_other" });
    await expect(
      creemProvider.handleWebhook(
        webhook("subscription.paid", {
          id: "sub_1",
          last_transaction_id: "tran_1",
        }),
      ),
    ).rejects.toThrow("association mismatch");
  });
  it("syncs active subscription without granting credits", async () => {
    respond(subscription);
    expect(await creemProvider.syncSubscription("sub_1")).toEqual({
      subscriptions: [
        {
          ...owner,
          subscriptionId: "sub_1",
          status: "ACTIVE",
          updatedAt: Date.parse(subscription.updated_at),
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("uses provider cumulative refunds, not callback amounts or IDs", async () => {
    respond({ ...transaction, status: "partialRefund", refunded_amount: 700 });
    const result = await creemProvider.handleWebhook(
      webhook("refund.created", {
        id: "ref_untrusted",
        refund_amount: 1900,
        refund_currency: "EUR",
        transaction: { id: "tran_1" },
      }),
    );
    expect(result.refunds).toEqual([
      {
        refundId: "tran_1:700",
        paymentId: "tran_1",
        amount: 700,
        currency: "USD",
        cumulative: true,
      },
    ]);
  });
  it("rejects inconsistent refund totals and transaction identities", async () => {
    respond({ ...transaction, status: "refunded", refunded_amount: 2000 });
    await expect(
      creemProvider.handleWebhook(
        webhook("refund.created", { transaction: "tran_1" }),
      ),
    ).rejects.toThrow("Invalid refunded amount");
    respond({ ...transaction, id: "tran_other" });
    await expect(
      creemProvider.handleWebhook(
        webhook("refund.created", { transaction: "tran_1" }),
      ),
    ).rejects.toThrow("identity mismatch");
  });
  it("acknowledges unknown signed events without state changes", async () => {
    expect(await creemProvider.handleWebhook(webhook("new.event", {}))).toEqual(
      {},
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("retries refund notifications until the API confirms settlement", async () => {
    respond(transaction);
    await expect(
      creemProvider.handleWebhook(
        webhook("refund.created", { transaction: "tran_1" }),
      ),
    ).rejects.toThrow("Refund not yet confirmed");
  });
});

describe("Creem checkout and cancellation", () => {
  const input = {
    ...owner,
    planId: "creator",
    mode: "subscription" as const,
    amount: 1900,
    credits: 500,
    email: "owner@example.test",
    name: "Creator",
  };
  const product = {
    id: "prod_creator",
    status: "active",
    price: 1900,
    currency: "USD",
    billing_type: "recurring",
    billing_period: "every-month",
    tax_mode: "inclusive",
  };
  it("validates product and forwards server-owned identity and request_id", async () => {
    respond(product);
    respond({ id: "ch_1", checkout_url: "https://creem.io/checkout/ch_1" });
    expect(await creemProvider.createCheckout(input)).toEqual({
      providerId: "ch_1",
      url: "https://creem.io/checkout/ch_1",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://test-api.creem.io/v1/products/prod_creator",
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      metadata: owner,
      request_id: owner.orderId,
      product_id: "prod_creator",
      units: 1,
    });
  });
  it.each([
    { price: 1800 },
    { currency: "EUR" },
    { tax_mode: "exclusive" },
    { billing_period: "every-year" },
    { trial_period_days: 7 },
    { business_net_pricing: true },
  ])("rejects incompatible product %j before checkout", async (change) => {
    respond({ ...product, ...change });
    await expect(creemProvider.createCheckout(input)).rejects.toThrow(
      "does not match",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("schedules cancellation at period end", async () => {
    respond({});
    await creemProvider.cancelSubscription("sub_1");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://test-api.creem.io/v1/subscriptions/sub_1/cancel",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      mode: "scheduled",
      onExecute: "cancel",
    });
  });
  it.each(["http://creem.io/checkout", "https://user:pass@creem.io/checkout"])(
    "rejects unsafe returned checkout URL %s",
    async (checkout_url) => {
      respond(product);
      respond({ id: "ch_1", checkout_url });
      await expect(creemProvider.createCheckout(input)).rejects.toThrow();
    },
  );
  it("accepts provider-returned custom checkout domains", async () => {
    respond(product);
    respond({
      id: "ch_1",
      checkout_url: "https://pay.brand.example/checkout/ch_1",
    });
    expect((await creemProvider.createCheckout(input)).url).toBe(
      "https://pay.brand.example/checkout/ch_1",
    );
  });
});

describe("Creem owned checkout recovery", () => {
  const recovery = {
    ...owner,
    providerId: "ch_1",
    amount: 1900,
    currency: "USD",
    mode: "subscription" as const,
  };
  it("recovers the canonical latest paid transaction without waiting for a lost webhook", async () => {
    respond({ ...checkout, subscription: "sub_1" });
    respond({ ...subscription, last_transaction_id: "tran_1" });
    respond(transaction);
    const result = await creemProvider.syncCheckout(recovery);
    expect(result.reconciliation.payments?.[0]).toMatchObject({
      ...owner,
      paymentId: "tran_1",
      subscriptionId: "sub_1",
      amount: 1900,
    });
    expect(result.url).toBeNull();
  });
  it("requires ownership before accepting checkout expiration", async () => {
    respond({
      ...checkout,
      status: "expired",
      metadata: { ...owner, userId: "other" },
    });
    await expect(creemProvider.syncCheckout(recovery)).rejects.toThrow(
      "owner mismatch",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not invent a request_id lookup when checkout_id is supplied", async () => {
    respond({ ...checkout, status: "expired" });
    expect(await creemProvider.syncCheckout(recovery)).toEqual({
      reconciliation: { expiredOrderIds: [owner.orderId] },
      url: null,
    });
    expect(fetchMock.mock.calls[0][0]).toContain("checkout_id=ch_1");
  });
});

it("validates a custom yearly product and keeps monthly/yearly bindings distinct", async () => {
  const input = {
    ...owner,
    planId: "year_custom",
    productRef: "prod_year",
    interval: "year" as const,
    amount: 19900,
    credits: 800,
    email: "u@example.test",
    name: "Year",
    mode: "subscription" as const,
  };
  const product = {
    id: "prod_year",
    status: "active",
    price: 19900,
    currency: "USD",
    tax_mode: "inclusive",
    billing_type: "recurring",
    billing_period: "every-year",
  };
  respond(product);
  await creemProvider.validateCheckout!(input);
  expect(fetchMock.mock.calls[0][0]).toContain("prod_year");
  respond(product);
  await expect(
    creemProvider.validateCheckout!({ ...input, interval: "month" }),
  ).rejects.toThrow("configured plan");
  respond(subscription);
  respond({
    ...transaction,
    period_start: 1769817600000,
    period_end: 1801353600000,
  });
  const result = await creemProvider.handleWebhook(
    webhook("subscription.paid", {
      id: "sub_1",
      last_transaction_id: "tran_1",
    }),
  );
  expect(result.payments?.[0]).toMatchObject({
    coveredFrom: 1769817600000,
    coveredUntil: 1801353600000,
  });
});
