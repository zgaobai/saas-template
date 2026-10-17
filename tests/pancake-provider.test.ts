import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
const mocks = vi.hoisted(() => ({
  env: {} as Record<string, any>,
  first: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => mocks.env,
  required: (value: string) => {
    if (!value) throw new Error("Missing setting");
    return value;
  },
}));
import { pancakeProvider } from "@/modules/billing/server/providers/pancake";
import {
  pancakeApi,
  verifyPancakeWebhook,
} from "@/modules/integrations/server/pancake";
const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 });
const platform = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = merchant.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const publicKey = platform.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const input = {
  orderId: "local_order",
  planId: "pack",
  amount: 900,
  credits: 200,
  userId: "owner",
  email: "owner@example.test",
  mode: "payment" as const,
  name: "积分包",
};
let local: Record<string, any>,
  remote: Record<string, any>,
  payments: Array<Record<string, any>>;
let calls: Array<{
  url: string;
  body: Record<string, any>;
  headers: Record<string, string>;
}>;
let fetcher: ReturnType<typeof vi.fn>;
function signed(event: object, age = 0) {
  const raw = JSON.stringify(event);
  const t = String(Date.now() - age);
  const v1 = sign(
    "RSA-SHA256",
    Buffer.from(`${t}.${raw}`),
    platform.privateKey,
  ).toString("base64");
  return { raw, header: `t=${t},v1=${v1}` };
}
function event(type = "order.completed") {
  return {
    id: "PAY_one",
    mode: "test",
    storeId: "STO_one",
    eventType: type,
    data: {
      orderId: "ORD_one",
      orderMerchantExternalId: local.id,
      paymentId: "PAY_one",
    },
  };
}
async function webhook(value = event()) {
  const { raw, header } = signed(value);
  return pancakeProvider.handleWebhook(
    new Request("https://app.test/api/webhooks/pancake", {
      method: "POST",
      headers: { "x-waffo-signature": header },
      body: raw,
    }),
  );
}
const recovery = () => ({
  providerId: "cs_session",
  orderId: local.id,
  userId: local.user_id,
  amount: local.amount,
  currency: "USD",
  mode:
    local.plan_id === "creator"
      ? ("subscription" as const)
      : ("payment" as const),
});
function subscription(period = 2) {
  local.plan_id = "creator";
  local.amount = 1900;
  remote = {
    ...remote,
    status: "active",
    billingPeriod: "monthly",
    currentPeriodNumber: period,
    currentPeriodStart: "2026-10-01T00:00:00Z",
    currentPeriodEnd: "2026-11-01T00:00:00Z",
    metadata: JSON.stringify({
      orderId: local.id,
      userId: local.user_id,
      planId: "creator",
    }),
  };
  payments = [
    {
      ...payments[0],
      periodNumber: period,
      amount: { amount: "1900", currency: "USD" },
    },
  ];
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env = {
    APP_URL: "https://app.test",
    PANCAKE_PRIVATE_KEY: key,
    PANCAKE_WEBHOOK_PUBLIC_KEY: publicKey,
    PANCAKE_MERCHANT_ID: "MER_one",
    PANCAKE_STORE_ID: "STO_one",
    PANCAKE_PACK_PRODUCT_ID: "PROD_pack",
    PANCAKE_CREATOR_PRODUCT_ID: "PROD_creator",
    PANCAKE_ENVIRONMENT: "test",
    DB: { prepare: () => ({ bind: () => ({ first: mocks.first }) }) },
  };
  local = {
    id: input.orderId,
    user_id: input.userId,
    plan_id: "pack",
    provider: "pancake",
    amount: 900,
    currency: "USD",
  };
  remote = {
    id: "ORD_one",
    status: "completed",
    orderMerchantExternalId: local.id,
    metadata: JSON.stringify({
      orderId: local.id,
      userId: local.user_id,
      planId: local.plan_id,
    }),
    updatedAt: "2026-10-15T00:00:00Z",
  };
  payments = [
    {
      id: "PAY_one",
      orderId: remote.id,
      orderMerchantExternalId: local.id,
      status: "succeeded",
      amount: { amount: "900", currency: "USD" },
      periodNumber: null,
      refunds: [],
    },
  ];
  mocks.first.mockImplementation(async () => local);
  calls = [];
  fetcher = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const headers = init.headers as Record<string, string>;
    calls.push({ url, body, headers });
    if (url.endsWith("/v1/graphql")) {
      if (body.query.includes("products:"))
        return Response.json({
          data: {
            store: {
              id: "STO_one",
              products: [
                {
                  id: body.query.includes("subscriptionProducts")
                    ? "PROD_creator"
                    : "PROD_pack",
                  status: "active",
                  billingPeriod: "monthly",
                },
              ],
            },
          },
        });
      if (body.query.includes("orders:"))
        return Response.json({ data: { orders: [remote] } });
      return Response.json({ data: { payments } });
    }
    if (url.endsWith("/create-session"))
      return Response.json({
        data: {
          sessionId: "cs_session",
          checkoutUrl:
            "https://pancake.waffo.ai/store/test/checkout/cs_session",
        },
      });
    return Response.json({ data: { orderId: "ORD_one", status: "canceling" } });
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());
describe("Pancake API protocol", () => {
  it("signs the exact transmitted body and fixes price, no trial, owner and return URL on the server", async () => {
    const result = await pancakeProvider.createCheckout(input);
    expect(result.providerId).toBe("cs_session");
    const call = calls.at(-1)!;
    expect(call.body).toMatchObject({
      currency: "USD",
      priceSnapshot: { amount: "9.00", taxIncluded: true },
      withTrial: false,
      orderMerchantExternalId: input.orderId,
      metadata: { orderId: input.orderId, userId: "owner", planId: "pack" },
      successUrl: "https://app.test/billing?checkout=returned",
      expiresInSeconds: 3600,
    });
    const path = new URL(call.url).pathname;
    const canonical = `POST\n${path}\n${call.headers["X-Timestamp"]}\n${createHash("sha256").update(JSON.stringify(call.body)).digest("base64")}`;
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(canonical),
        merchant.publicKey,
        Buffer.from(call.headers["X-Signature"], "base64"),
      ),
    ).toBe(true);
    expect(call.headers["X-Environment"]).toBeUndefined();
    expect(JSON.stringify(calls)).not.toContain(key);
  });
  it("refuses HTTP success URLs before creating an order", async () => {
    mocks.env.APP_URL = "http://127.0.0.1:4317";
    await expect(pancakeProvider.createCheckout(input)).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a mismatched product before creating a checkout", async () => {
    fetcher.mockResolvedValueOnce(
      Response.json({
        data: {
          store: {
            id: "STO_one",
            products: [{ id: "other", status: "active" }],
          },
        },
      }),
    );
    await expect(pancakeProvider.createCheckout(input)).rejects.toThrow(
      "product",
    );
    expect(calls).toHaveLength(0);
  });
  it("rejects GraphQL partial results and does not leak provider errors", async () => {
    fetcher.mockResolvedValueOnce(
      Response.json({
        data: { orders: [remote] },
        errors: [{ message: "private detail" }],
      }),
    );
    await expect(pancakeApi("/v1/graphql", {})).rejects.toThrow(
      "Invalid Pancake response",
    );
  });
  it("uses a 45-minute retry window and rejects tampered bytes and stale signatures", () => {
    const ok = signed(event(), 31 * 60000);
    expect(() => verifyPancakeWebhook(ok.raw, ok.header)).not.toThrow();
    expect(() => verifyPancakeWebhook(ok.raw + " ", ok.header)).toThrow();
    const stale = signed(event(), 46 * 60000);
    expect(() => verifyPancakeWebhook(stale.raw, stale.header)).toThrow();
    expect(() => verifyPancakeWebhook(ok.raw, "t=NaN,v1=x")).toThrow();
  });
});
describe("Pancake canonical reconciliation", () => {
  it("reads confirmed charges from GraphQL instead of trusting webhook amounts", async () => {
    const value = event();
    Object.assign(value.data, { amount: "0.01", chargedAmount: "0.01" });
    const result = await webhook(value);
    expect(result.payments).toEqual([
      {
        orderId: local.id,
        userId: "owner",
        paymentId: "PAY_one",
        amount: 900,
        currency: "USD",
      },
    ]);
    expect(
      calls.every((c) => c.url === "https://api.waffo.ai/v1/graphql"),
    ).toBe(true);
  });
  it.each([{ mode: "prod" }, { storeId: "STO_other" }])(
    "rejects wrong webhook scope %j",
    async (change) => {
      await expect(webhook({ ...event(), ...change })).rejects.toMatchObject({
        status: 400,
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { amount: "9", currency: "USD" },
    { amount: "900", currency: "EUR" },
    { amount: "9.00", currency: "USD" },
  ])("rejects amount/currency mismatch %j", async (amount) => {
    payments[0].amount = amount;
    await expect(webhook()).rejects.toThrow(/amount|currency/);
  });
  it("refuses legacy provider rows, never maps them to Pancake", async () => {
    local.provider = "waffo";
    await expect(webhook()).rejects.toThrow("identity");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("checks canonical owner metadata and payment association", async () => {
    remote.metadata = JSON.stringify({
      orderId: local.id,
      userId: "other",
      planId: "pack",
    });
    await expect(webhook()).rejects.toThrow("owner");
    remote.metadata = JSON.stringify({
      orderId: local.id,
      userId: "owner",
      planId: "pack",
    });
    payments[0].orderId = "ORD_other";
    await expect(webhook()).rejects.toThrow("association");
  });
  it("asks for retry when signed success is not yet readable", async () => {
    payments[0].status = "pending";
    await expect(webhook()).rejects.toThrow("Await Pancake payment");
  });
  it("does not mistake an uncreated order for a failed payment", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ data: { orders: [] } }));
    expect(await pancakeProvider.syncCheckout(recovery())).toEqual({
      reconciliation: {},
    });
  });
  it("recovers after a lost session response using the original business reference", async () => {
    const result = await pancakeProvider.syncCheckout({
      ...recovery(),
      providerId: "",
    });
    expect(result.reconciliation.payments?.[0].paymentId).toBe("PAY_one");
    expect(calls[0].body.variables.ref).toBe(local.id);
    expect(calls.some((c) => c.url.includes("create-session"))).toBe(false);
  });
  it("rejects ambiguous external references", async () => {
    fetcher.mockResolvedValueOnce(
      Response.json({ data: { orders: [remote, remote] } }),
    );
    await expect(pancakeProvider.syncCheckout(recovery())).rejects.toThrow(
      "Ambiguous",
    );
  });
  it("records each executed refund from channel display amount and retries missing refund evidence", async () => {
    payments[0].refunds = [
      {
        id: "REF_one",
        status: "succeeded",
        pspAmountDetails: { amount: "3.00", currency: "USD" },
      },
    ];
    const value = { ...event("refund.succeeded"), id: "REF_one" };
    expect((await webhook(value)).refunds).toEqual([
      {
        refundId: "REF_one",
        paymentId: "PAY_one",
        amount: 300,
        currency: "USD",
      },
    ]);
    payments[0].refunds[0].status = "processing";
    await expect(webhook(value)).rejects.toThrow("Await Pancake refund");
  });
  it("does not extend access with an old payment when the new period has failed", async () => {
    subscription(2);
    payments[0].periodNumber = 1;
    const result = await pancakeProvider.syncCheckout(recovery());
    expect(result.reconciliation.payments?.[0].coveredUntil).toBe(0);
  });
  it("extends access only from the successful current-period charge", async () => {
    subscription(2);
    const result = await pancakeProvider.syncCheckout(recovery());
    expect(result.reconciliation.payments?.[0]).toMatchObject({
      coveredUntil: Date.parse("2026-11-01T00:00:00Z"),
      subscriptionId: "ORD_one",
    });
  });
  it("waits for the API billing period instead of inventing dates", async () => {
    subscription();
    remote.currentPeriodNumber = null;
    await expect(pancakeProvider.syncCheckout(recovery())).rejects.toThrow(
      "billing period",
    );
  });
  it("cancels using the subscription order ID and retains canceling as nonterminal", async () => {
    subscription();
    remote.status = "canceling";
    await pancakeProvider.cancelSubscription("ORD_one");
    expect(calls[0].body).toEqual({ orderId: "ORD_one" });
    expect(calls[0].url).toContain("/subscription-order/cancel-order");
    expect(
      (await pancakeProvider.syncSubscription("ORD_one")).subscriptions?.[0]
        .status,
    ).toBe("CANCELING");
  });
  it("reads additional payment pages", async () => {
    const oldFetch = fetcher.getMockImplementation()! as (
      url: string,
      init: RequestInit,
    ) => Promise<Response>;
    fetcher.mockImplementation(async (url: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      if (b.query?.includes("payments(filter"))
        return Response.json({
          data: {
            payments:
              b.variables.offset === 0
                ? Array.from({ length: 100 }, (_, i) => ({
                    ...payments[0],
                    id: `PAY_${i}`,
                  }))
                : [],
          },
        });
      return oldFetch(url, init);
    });
    expect(
      (await pancakeProvider.syncCheckout(recovery())).reconciliation.payments,
    ).toHaveLength(100);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

it("uses dynamic annual product binding and annual order snapshots during read-back", async () => {
  const original = fetcher.getMockImplementation()! as (
    url: string,
    init: RequestInit,
  ) => Promise<Response>;
  fetcher.mockImplementation(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (body.query?.includes("products:"))
      return Response.json({
        data: {
          store: {
            id: "STO_one",
            products: [
              { id: "PROD_year", status: "active", billingPeriod: "yearly" },
            ],
          },
        },
      });
    return original(url, init);
  });
  await pancakeProvider.validateCheckout!({
    ...input,
    planId: "custom_year",
    mode: "subscription",
    interval: "year",
    productRef: "PROD_year",
  });
  await expect(
    pancakeProvider.validateCheckout!({
      ...input,
      planId: "custom_year",
      mode: "subscription",
      interval: "month",
      productRef: "PROD_year",
    }),
  ).rejects.toThrow("configured store/plan");
  subscription(1);
  local.plan_id = "custom_year";
  local.payment_mode = "subscription";
  local.billing_interval = "year";
  remote.billingPeriod = "yearly";
  remote.currentPeriodEnd = "2027-10-01T00:00:00Z";
  remote.metadata = JSON.stringify({
    orderId: local.id,
    userId: local.user_id,
    planId: local.plan_id,
  });
  const result = await pancakeProvider.syncCheckout({
    ...recovery(),
    mode: "subscription",
  });
  expect(result.reconciliation.payments?.[0]).toMatchObject({
    coveredFrom: Date.parse("2026-10-01T00:00:00Z"),
    coveredUntil: Date.parse("2027-10-01T00:00:00Z"),
  });
});
