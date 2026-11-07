import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => ({
    APP_URL: "https://app.example.test",
    ANYWAY_API_KEY: "fixture-anyway-key",
    ANYWAY_WEBHOOK_SECRET: "whsec_YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=", // base64 of secret
    ANYWAY_ENVIRONMENT: "staging",
    ANYWAY_CREATOR_PRODUCT_ID: "prod_creator",
    ANYWAY_PACK_PRODUCT_ID: "prod_pack",
  }),
  required: (value: string | undefined, name: string) => {
    if (!value) throw new Error(`Missing server setting: ${name}`);
    return value;
  },
}));

import { anywayProvider } from "@/modules/billing/server/providers/anyway";

const secretBytes = Buffer.from("YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=", "base64");
const owner = { orderId: "ord_local_123", userId: "usr_local_456" };

const mockSession = {
  id: "cs_123456",
  status: "completed",
  merchantReference: owner.orderId,
  orderId: "ord_anyway_789",
  amount: 1900,
  currency: "USD",
  url: "https://pay.anyway.sh/pay/cs_123456",
  metadata: {
    orderId: owner.orderId,
    userId: owner.userId,
  },
  subscriptionId: "sub_123",
  periodEnd: 1793491200000,
};

const mockOrder = {
  id: "ord_anyway_789",
  status: "paid",
  merchantReference: owner.orderId,
  amount: 1900,
  currency: "USD",
  metadata: {
    orderId: owner.orderId,
    userId: owner.userId,
  },
};

const mockSubscription = {
  id: "sub_123",
  status: "active",
  merchantReference: owner.orderId,
  updatedAt: 1731000000000,
  metadata: {
    orderId: owner.orderId,
    userId: owner.userId,
  },
};

const fetchMock = vi.fn();

function respond(value: unknown) {
  fetchMock.mockResolvedValueOnce(Response.json(value));
}

function makeWebhookRequest(
  type: string,
  data: unknown,
  options: {
    id?: string;
    timestamp?: string;
    signature?: string;
  } = {},
) {
  const body = JSON.stringify({ id: "evt_1", type, data });
  const id = options.id ?? "msg_123456";
  const ts = options.timestamp ?? Math.floor(Date.now() / 1000).toString();

  const toSign = `${id}.${ts}.${body}`;
  const validSig =
    options.signature ??
    `v1,${createHmac("sha256", secretBytes).update(toSign).digest("base64")}`;

  return new Request("https://app.example.test/api/webhooks/anyway", {
    method: "POST",
    body,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": validSig,
    },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Anyway provider reconciliation and security", () => {
  it("rejects webhook if headers are missing", async () => {
    const req = new Request("https://app.example.test/api/webhooks/anyway", {
      method: "POST",
      body: JSON.stringify({ type: "order.paid" }),
    });
    await expect(anywayProvider.handleWebhook(req)).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects forged signatures before querying provider API", async () => {
    const req = makeWebhookRequest("order.paid", { id: "ord_1" }, {
      signature: "v1,invalid_base64_sig==",
    });
    await expect(anywayProvider.handleWebhook(req)).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects expired webhook timestamps to prevent replay attacks", async () => {
    const expiredTs = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
    const req = makeWebhookRequest("order.paid", { id: "ord_1" }, {
      timestamp: expiredTs,
    });
    await expect(anywayProvider.handleWebhook(req)).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads order truth exclusively from API read-back on order.paid", async () => {
    respond(mockOrder);

    // Attacker tries to forge $1 EUR in webhook payload
    const req = makeWebhookRequest("order.paid", {
      id: "ord_anyway_789",
      amount: 100,
      currency: "EUR",
      merchantReference: "forged_order",
    });

    const result = await anywayProvider.handleWebhook(req);

    // API read-back returns true $19.00 USD and correct internal order
    expect(result.payments).toEqual([
      {
        orderId: owner.orderId,
        userId: owner.userId,
        paymentId: "ord_anyway_789",
        amount: 1900,
        currency: "USD",
      },
    ]);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://merchant-api-stg.anyway.sh/v1/orders/ord_anyway_789",
    );
  });

  it("handles checkout.session.completed with subscription", async () => {
    respond(mockSession);

    const req = makeWebhookRequest("checkout.session.completed", {
      id: "cs_123456",
    });

    const result = await anywayProvider.handleWebhook(req);

    expect(result.payments).toBeDefined();
    expect(result.payments![0].orderId).toBe(owner.orderId);
    expect(result.payments![0].amount).toBe(1900);
    expect(result.payments![0].subscriptionId).toBe("sub_123");

    expect(result.subscriptions).toBeDefined();
    expect(result.subscriptions![0].status).toBe("ACTIVE");
    expect(result.subscriptions![0].subscriptionId).toBe("sub_123");
  });

  it("handles order.refunded with cumulative amount", async () => {
    respond({
      ...mockOrder,
      status: "refunded",
      refundedAmount: 1900,
    });

    const req = makeWebhookRequest("order.refunded", {
      id: "ord_anyway_789",
    });

    const result = await anywayProvider.handleWebhook(req);

    expect(result.refunds).toEqual([
      {
        refundId: "ord_anyway_789:refund:1900",
        paymentId: "ord_anyway_789",
        amount: 1900,
        currency: "USD",
        cumulative: true,
      },
    ]);
  });

  it("creates checkout session and returns hosted URL", async () => {
    respond({ id: "prod_creator", price: 1900, currency: "USD" }); // product validation
    respond({
      id: "cs_new",
      url: "https://pay.anyway.sh/pay/cs_new",
    }); // session creation

    const result = await anywayProvider.createCheckout({
      orderId: "ord_new_1",
      planId: "creator",
      amount: 1900,
      credits: 100,
      userId: "usr_1",
      email: "test@example.com",
      mode: "subscription",
      name: "Creator Plan",
    });

    expect(result.providerId).toBe("cs_new");
    expect(result.url).toBe("https://pay.anyway.sh/pay/cs_new");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://merchant-api-stg.anyway.sh/v1/checkout-sessions",
    );
  });

  it("syncs checkout when completed", async () => {
    respond(mockSession);

    const result = await anywayProvider.syncCheckout({
      providerId: "cs_123456",
      orderId: owner.orderId,
      userId: owner.userId,
      amount: 1900,
      currency: "USD",
      mode: "subscription",
    });

    expect(result.url).toBeNull();
    expect(result.reconciliation.payments).toHaveLength(1);
    expect(result.reconciliation.payments![0].paymentId).toBe("ord_anyway_789");
    expect(result.reconciliation.subscriptions).toHaveLength(1);
  });

  it("syncs checkout when expired", async () => {
    respond({
      ...mockSession,
      status: "expired",
    });

    const result = await anywayProvider.syncCheckout({
      providerId: "cs_123456",
      orderId: owner.orderId,
      userId: owner.userId,
      amount: 1900,
      currency: "USD",
      mode: "subscription",
    });

    expect(result.url).toBeNull();
    expect(result.reconciliation.expiredOrderIds).toEqual([owner.orderId]);
  });

  it("cancels and syncs subscription lifecycle", async () => {
    respond({});
    await anywayProvider.cancelSubscription("sub_123");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://merchant-api-stg.anyway.sh/v1/subscriptions/sub_123/cancel",
    );

    respond({
      ...mockSubscription,
      status: "canceled",
    });
    const syncRes = await anywayProvider.syncSubscription("sub_123");
    expect(syncRes.subscriptions).toEqual([
      {
        orderId: owner.orderId,
        userId: owner.userId,
        subscriptionId: "sub_123",
        status: "CANCELED",
        updatedAt: 1731000000000,
      },
    ]);
  });
});
