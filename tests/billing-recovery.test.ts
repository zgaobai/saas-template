import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  batch: vi.fn(),
  sql: [] as Array<{ sql: string; values: unknown[] }>,
  provider: vi.fn(),
  sync: vi.fn(),
  preflight: vi.fn(),
  create: vi.fn(),
  apply: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => ({
    DB: {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => {
          mocks.sql.push({ sql, values });
          return { first: mocks.first, all: mocks.all, run: mocks.run };
        },
      }),
      batch: mocks.batch,
    },
  }),
}));
vi.mock("@/modules/credits/server/service", () => ({ ensureWallet: vi.fn() }));
vi.mock("@/modules/billing/server/providers/registry", () => ({
  paymentProvider: mocks.provider,
}));
vi.mock("@/modules/billing/server/reconciliation", () => ({
  applyReconciliation: mocks.apply,
}));
vi.mock("@/modules/billing/server/plans", () => ({
  getPlan: async (id: string) => ({
    id,
    name: "Test",
    mode: id === "creator" ? "subscription" : "payment",
    price: id === "creator" ? 1900 : 900,
    credits: id === "creator" ? 500 : 200,
    enabled: true,
    revision: 1,
    paymentBindings: { creem: "prod_test", pancake: "PROD_test" },
  }),
}));
import { checkout, recoverBilling } from "@/modules/billing/server/service";
const row = {
  id: "order_owned",
  user_id: "user_owned",
  provider: "stripe",
  provider_id: "cs_known",
  amount: 900,
  currency: "USD",
  plan_id: "pack",
};
const payment = {
  orderId: row.id,
  userId: row.user_id,
  paymentId: "pi_paid",
  amount: 900,
  currency: "USD",
};
const request = () =>
  new Request("https://app.test/api/app/checkout", {
    method: "POST",
    body: JSON.stringify({
      planId: "pack",
      requestId: "7e5a9a14-b5a7-49a0-8cc0-322332a169ad",
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.sql.length = 0;
  mocks.provider.mockImplementation((id = "creem") => ({
    id,
    syncCheckout: mocks.sync,
    validateCheckout: mocks.preflight,
    createCheckout: mocks.create,
  }));
  mocks.all.mockResolvedValue({ results: [row] });
  mocks.first.mockResolvedValue({ status: "paid" });
  mocks.sync.mockResolvedValue({
    reconciliation: { payments: [payment] },
    url: null,
  });
});
describe("owner-scoped billing recovery", () => {
  it("bounds queries to the signed-in owner and preserves the historical provider", async () => {
    expect(await recoverBilling(row.user_id)).toEqual({
      checked: 1,
      pending: 0,
      needsSupport: 0,
      failed: 0,
    });
    expect(mocks.sql[0].values).toEqual([row.user_id, null, null]);
    expect(mocks.sql[0].sql).toContain("WHERE user_id=?");
    expect(mocks.sql[0].sql).toContain("LIMIT 10");
    expect(mocks.provider).toHaveBeenCalledWith("stripe");
    expect(mocks.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "cs_known",
        orderId: row.id,
        userId: row.user_id,
      }),
    );
    expect(mocks.apply).toHaveBeenCalledWith("stripe", { payments: [payment] });
    expect(
      mocks.sql.some(
        (q) => q.sql.includes("SET checkout_url") && q.values[0] === null,
      ),
    ).toBe(true);
  });
  it.each([
    { userId: "another_user" },
    { orderId: "another_order" },
    { amount: 1 },
    { currency: "EUR" },
  ])("does not apply mismatched provider evidence %j", async (change) => {
    mocks.sync.mockResolvedValue({
      reconciliation: { payments: [{ ...payment, ...change }] },
    });
    expect((await recoverBilling(row.user_id)).failed).toBe(1);
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("never expires another checkout or applies an unrelated refund", async () => {
    mocks.sync.mockResolvedValue({
      reconciliation: { expiredOrderIds: ["other"] },
    });
    expect((await recoverBilling(row.user_id)).failed).toBe(1);
    mocks.sync.mockResolvedValue({
      reconciliation: {
        refunds: [
          {
            paymentId: "other",
            refundId: "refund_other",
            amount: 100,
            currency: "USD",
          },
        ],
      },
    });
    expect((await recoverBilling(row.user_id)).failed).toBe(1);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("keeps unknown Creem creation results for merchant reconciliation without creating/deleting", async () => {
    mocks.all.mockResolvedValue({
      results: [{ ...row, provider: "creem", provider_id: null }],
    });
    expect((await recoverBilling(row.user_id)).needsSupport).toBe(1);
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("recovers Pancake by external order reference after a lost create response", async () => {
    mocks.all.mockResolvedValue({
      results: [{ ...row, provider: "pancake", provider_id: null }],
    });
    mocks.sync.mockResolvedValue({
      reconciliation: { payments: [payment] },
      url: null,
    });
    mocks.first.mockResolvedValue({ status: "pending" });
    expect((await recoverBilling(row.user_id)).pending).toBe(1);
    expect(mocks.sync).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "", orderId: row.id }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("retains pending orders when the provider is unavailable, with no raw error leakage", async () => {
    mocks.sync.mockRejectedValue(new Error("sensitive-provider-response"));
    const result = await recoverBilling(row.user_id);
    expect(result.failed).toBe(1);
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
describe("checkout preflight", () => {
  it("validates product before inserting a pending order", async () => {
    mocks.first.mockResolvedValue(null);
    mocks.preflight.mockRejectedValue(new Error("Product mismatch"));
    await expect(
      checkout(request(), { id: row.user_id, email: "owner@example.test" }),
    ).rejects.toThrow("Product mismatch");
    expect(mocks.sql.some((q) => q.sql.includes("INSERT INTO orders"))).toBe(
      false,
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not delete a pending order after an unknown create failure", async () => {
    mocks.first.mockResolvedValue(null);
    mocks.create.mockRejectedValue(
      new Error("network timeout after submission"),
    );
    await expect(
      checkout(request(), { id: row.user_id, email: "owner@example.test" }),
    ).rejects.toThrow();
    expect(mocks.sql.some((q) => q.sql.includes("INSERT INTO orders"))).toBe(
      true,
    );
    expect(mocks.sql.some((q) => /DELETE|status='expired'/.test(q.sql))).toBe(
      false,
    );
  });
});

it("never repeats an unknown Pancake checkout creation", async () => {
  mocks.first.mockResolvedValueOnce({
    user_id: row.user_id,
    plan_id: "pack",
    provider: "pancake",
    status: "pending",
    checkout_url: null,
    amount: 900,
    credits: 200,
    created_at: Date.now(),
  });
  await expect(
    checkout(request(), { id: row.user_id, email: "owner@example.test" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.create).not.toHaveBeenCalled();
});
