import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  createdCheckout: vi.fn(),
  validatedCheckout: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => state.env,
  paymentConfigured: (provider?: string) => {
    const prov = provider || state.env.PAYMENT_PROVIDER || "pancake";
    if (prov === "paypal") {
      return Boolean(state.env.PAYPAL_CLIENT_ID && state.env.PAYPAL_CLIENT_SECRET);
    }
    if (prov === "pancake") {
      return Boolean(state.env.PANCAKE_MERCHANT_ID);
    }
    if (prov === "stripe") {
      return Boolean(state.env.STRIPE_SECRET_KEY);
    }
    return false;
  },
  publicCapabilities: () => {
    const primary = (state.env.PAYMENT_PROVIDER || "pancake") as string;
    const paymentProviders: string[] = [];
    if (primary === "pancake" && state.env.PANCAKE_MERCHANT_ID) {
      paymentProviders.push("pancake");
    }
    if (primary === "stripe" && state.env.STRIPE_SECRET_KEY) {
      paymentProviders.push("stripe");
    }
    if (state.env.PAYPAL_CLIENT_ID && state.env.PAYPAL_CLIENT_SECRET) {
      if (!paymentProviders.includes("paypal")) {
        paymentProviders.push("paypal");
      }
    }
    return {
      payments: paymentProviders.length > 0,
      paymentProviders,
    };
  },
}));

vi.mock("@/modules/billing/server/providers/registry", () => ({
  paymentProvider: (id = "pancake") => ({
    id,
    validateCheckout: state.validatedCheckout,
    createCheckout: async (input: any) => {
      state.createdCheckout(input);
      return {
        providerId: `${id}_order_123`,
        url: `https://${id}.checkout.test/pay`,
      };
    },
  }),
}));

vi.mock("@/modules/billing/server/plans", () => ({
  getPlan: async (id: string) => ({
    id,
    name: "测试套餐",
    mode: "subscription",
    price: 1900,
    credits: 100,
    interval: "month",
    enabled: true,
    revision: 1,
    paymentBindings: {
      pancake: "prod_pancake_1",
      paypal: "P-PAYPAL-1",
    },
  }),
}));

vi.mock("@/modules/credits/server/service", () => ({
  ensureWallet: async () => {},
}));

describe("dual-channel checkout", () => {
  let dbQueries: any[] = [];
  beforeEach(() => {
    vi.resetAllMocks();
    dbQueries = [];
    state.env = {
      PANCAKE_MERCHANT_ID: "merc_1",
      PAYPAL_CLIENT_ID: "paypal_id",
      PAYPAL_CLIENT_SECRET: "paypal_sec",
      PAYMENT_PROVIDER: "pancake",
      DB: {
        prepare: (sql: string) => ({
          bind: (...args: any[]) => {
            dbQueries.push({ sql, args });
            return {
              first: async () => null,
              run: async () => ({ meta: { changes: 1 } }),
            };
          },
        }),
        batch: async () => {},
      },
    };
  });

  it("exposes both card and paypal in public capabilities when both are configured", async () => {
    const { publicCapabilities } = await import("@/server/env");
    const caps = publicCapabilities() as any;
    expect(caps.payments).toBe(true);
    expect(caps.paymentProviders).toEqual(["pancake", "paypal"]);
  });

  it("supports explicit provider dispatch in checkout endpoint", async () => {
    const { checkout } = await import("@/modules/billing/server/service");
    const req = new Request("https://app.test/api/app/checkout", {
      method: "POST",
      body: JSON.stringify({
        planId: "creator",
        requestId: "3e5b3218-1f48-4cb2-9d33-1498b5847db1",
        interval: "month",
        provider: "paypal",
      }),
    });

    const res = await checkout(req, {
      id: "user_test",
      email: "user@example.test",
    });

    expect(res.url).toBe("https://paypal.checkout.test/pay");
    expect(state.createdCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        productRef: "P-PAYPAL-1",
      }),
    );
  });
});
