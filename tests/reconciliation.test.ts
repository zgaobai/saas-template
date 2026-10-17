import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
const state = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({ bindings: () => state.env }));
import { applyReconciliation } from "@/modules/billing/server/reconciliation";
let db: DatabaseSync;
function statement(sql: string, args: unknown[] = []): any {
  return {
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...(args as any[])) ?? null,
    run: async () => db.prepare(sql).run(...(args as any[])),
    all: async () => ({ results: db.prepare(sql).all(...(args as any[])) }),
    sql,
    args,
  };
}
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("migrations/" + file, "utf8"));
  db.exec(
    "INSERT INTO user (id,name,email,email_verified,image,created_at,updated_at) VALUES ('u','Test','u@example.test',1,NULL,0,0); INSERT INTO wallets VALUES ('u',0)",
  );
  state.env = {
    DB: {
      prepare: statement,
      batch: async (statements: any[]) => {
        db.exec("BEGIN");
        try {
          for (const s of statements) db.prepare(s.sql).run(...s.args);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
  };
});
afterEach(() => db.close());
function order(provider = "stripe", plan = "pack") {
  db.prepare(
    "INSERT INTO orders (id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES ('o','u',?,?,900,'USD',200,'pending',0)",
  ).run(plan, provider);
}
const payment = {
  orderId: "o",
  userId: "u",
  paymentId: "pay",
  amount: 900,
  currency: "USD",
};
const balance = () =>
  db.prepare("SELECT balance FROM wallets WHERE user_id='u'").get()?.balance;
it("credits a confirmed receipt once across replayed events", async () => {
  order();
  await applyReconciliation("stripe", { payments: [payment, payment] });
  expect(balance()).toBe(200);
});
it("rejects wrong provider, owner, amount and mode before crediting", async () => {
  order();
  await expect(
    applyReconciliation("creem", { payments: [payment] }),
  ).rejects.toThrow("identity");
  await expect(
    applyReconciliation("stripe", {
      payments: [{ ...payment, userId: "someone" }],
    }),
  ).rejects.toThrow("identity");
  await expect(
    applyReconciliation("stripe", { payments: [{ ...payment, amount: 1 }] }),
  ).rejects.toThrow("amount");
  await expect(
    applyReconciliation("stripe", {
      payments: [{ ...payment, subscriptionId: "sub" }],
    }),
  ).rejects.toThrow("mode");
  expect(balance()).toBe(0);
});
it("a repeated full refund is acknowledged without a second revoke or trigger failure", async () => {
  order();
  await applyReconciliation("stripe", { payments: [payment] });
  const refund = {
    refundId: "r",
    paymentId: "pay",
    amount: 900,
    currency: "USD",
  };
  await applyReconciliation("stripe", { refunds: [refund, refund] });
  await applyReconciliation("stripe", { payments: [payment] });
  expect(balance()).toBe(0);
  expect(db.prepare("SELECT status FROM orders").get()?.status).toBe(
    "refunded",
  );
});
it("cumulative refunds can arrive out of order without over-revocation", async () => {
  order("creem");
  await applyReconciliation("creem", { payments: [payment] });
  for (const amount of [450, 300, 900, 450, 900])
    await applyReconciliation("creem", {
      refunds: [
        {
          refundId: "r" + amount,
          paymentId: "pay",
          amount,
          currency: "USD",
          cumulative: true,
        },
      ],
    });
  expect(balance()).toBe(0);
  expect(
    db.prepare("SELECT SUM(amount) AS total FROM refund_events").get()?.total,
  ).toBe(900);
});
it("does not restore fully refunded subscription time on payment replay", async () => {
  order("stripe", "creator");
  const subscription = {
    orderId: "o",
    userId: "u",
    subscriptionId: "sub",
    status: "ACTIVE" as const,
    updatedAt: 100,
  };
  const p = {
    ...payment,
    subscriptionId: "sub",
    coveredUntil: Date.now() + 86400000,
  };
  await applyReconciliation("stripe", {
    subscriptions: [subscription],
    payments: [p],
  });
  await applyReconciliation("stripe", {
    refunds: [
      { refundId: "r", paymentId: "pay", amount: 900, currency: "USD" },
    ],
  });
  await applyReconciliation("stripe", {
    subscriptions: [subscription],
    payments: [p],
  });
  expect(
    db.prepare("SELECT paid_until FROM subscriptions").get()?.paid_until,
  ).toBe(0);
  expect(balance()).toBe(0);
});
it("cancellation preserves paid access; stale active event cannot overwrite it", async () => {
  order("paypal", "creator");
  const subscription = {
    orderId: "o",
    userId: "u",
    subscriptionId: "sub",
    status: "ACTIVE" as const,
    updatedAt: 100,
  };
  const until = Date.now() + 86400000;
  await applyReconciliation("paypal", {
    subscriptions: [subscription],
    payments: [{ ...payment, subscriptionId: "sub", coveredUntil: until }],
  });
  await applyReconciliation("paypal", {
    subscriptions: [
      { ...subscription, status: "CANCELED", updatedAt: 200 },
      subscription,
    ],
  });
  expect(
    db.prepare("SELECT status,paid_until FROM subscriptions").get(),
  ).toMatchObject({ status: "CANCELED", paid_until: until });
});
it("rejects a different subscription attached to the same order", async () => {
  order("stripe", "creator");
  const subscription = {
    orderId: "o",
    userId: "u",
    subscriptionId: "sub",
    status: "ACTIVE" as const,
    updatedAt: 100,
  };
  await applyReconciliation("stripe", { subscriptions: [subscription] });
  await expect(
    applyReconciliation("stripe", {
      subscriptions: [{ ...subscription, subscriptionId: "other" }],
    }),
  ).rejects.toThrow("conflict");
});
it("expiry only releases pending checkouts, never reverses a paid order", async () => {
  order();
  await applyReconciliation("stripe", {
    payments: [payment],
    expiredOrderIds: ["o"],
  });
  expect(db.prepare("SELECT status FROM orders").get()?.status).toBe("paid");
});

it("Pancake replayed payments and executed refunds change the ledger only once", async () => {
  order("pancake");
  const result = {
    payments: [payment],
    refunds: [
      { refundId: "REF_one", paymentId: "pay", amount: 450, currency: "USD" },
    ],
  };
  await applyReconciliation("pancake", result);
  await applyReconciliation("pancake", result);
  expect(balance()).toBe(100);
  expect(db.prepare("SELECT COUNT(*) AS n FROM receipts").get()?.n).toBe(1);
});
it("Pancake canceling retains paid access while terminal closure remains blocked", async () => {
  order("pancake", "creator");
  await applyReconciliation("pancake", {
    subscriptions: [
      {
        orderId: "o",
        userId: "u",
        subscriptionId: "ORD_one",
        status: "CANCELING",
        updatedAt: 123,
      },
    ],
    payments: [{ ...payment, subscriptionId: "ORD_one", coveredUntil: 9999 }],
  });
  expect(
    db.prepare("SELECT status,paid_until FROM subscriptions").get(),
  ).toMatchObject({ status: "CANCELING", paid_until: 9999 });
});

import {
  grantDueInstallments,
  monthlyDate,
} from "@/modules/billing/server/installments";
const annualStart = Date.UTC(2026, 0, 31, 10);
const annualEnd = Date.UTC(2027, 0, 31, 10);
async function annualPaid() {
  order("stripe", "custom_annual");
  db.prepare(
    "UPDATE orders SET payment_mode='subscription',billing_interval='year',credits=100 WHERE id='o'",
  ).run();
  const p = {
    ...payment,
    subscriptionId: "sub_year",
    coveredFrom: annualStart,
    coveredUntil: annualEnd,
  };
  await applyReconciliation("stripe", {
    subscriptions: [
      {
        orderId: "o",
        userId: "u",
        subscriptionId: "sub_year",
        status: "ACTIVE",
        updatedAt: annualStart,
      },
    ],
    payments: [p],
  });
  return p;
}
it("grants annual credits monthly, preserves calendar anchors and never duplicates on cron/payment replay", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(annualStart);
  try {
    const p = await annualPaid();
    expect(balance()).toBe(100);
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM credit_installments").get()?.n,
    ).toBe(12);
    expect(monthlyDate(annualStart, 1)).toBe(Date.UTC(2026, 1, 28, 10));
    expect(monthlyDate(annualStart, 2)).toBe(Date.UTC(2026, 2, 31, 10));
    expect(monthlyDate(Date.UTC(2028, 0, 31, 10), 1)).toBe(
      Date.UTC(2028, 1, 29, 10),
    );
    await grantDueInstallments(monthlyDate(annualStart, 1) - 1);
    expect(balance()).toBe(100);
    await Promise.all([
      grantDueInstallments(monthlyDate(annualStart, 1)),
      grantDueInstallments(monthlyDate(annualStart, 1)),
    ]);
    expect(balance()).toBe(200);
    db.exec("UPDATE orders SET credits=999 WHERE id='o'");
    await applyReconciliation("stripe", { payments: [p] });
    expect(balance()).toBe(200);
    await grantDueInstallments(annualEnd + 86400000);
    expect(balance()).toBe(1200);
    expect(db.prepare("SELECT credits FROM receipts").get()?.credits).toBe(
      1200,
    );
  } finally {
    clock.mockRestore();
  }
});
it("keeps annual installments after canceling renewals, prorates partial refunds and stops after a full refund", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(annualStart);
  try {
    await annualPaid();
    await applyReconciliation("stripe", {
      subscriptions: [
        {
          orderId: "o",
          userId: "u",
          subscriptionId: "sub_year",
          status: "CANCELING",
          updatedAt: annualStart + 1,
        },
      ],
    });
    await applyReconciliation("stripe", {
      refunds: [
        { refundId: "half", paymentId: "pay", amount: 450, currency: "USD" },
      ],
    });
    expect(balance()).toBe(50);
    await grantDueInstallments(monthlyDate(annualStart, 1));
    expect(balance()).toBe(100);
    await applyReconciliation("stripe", {
      refunds: [
        { refundId: "rest", paymentId: "pay", amount: 450, currency: "USD" },
      ],
    });
    expect(balance()).toBe(0);
    await grantDueInstallments(annualEnd);
    expect(balance()).toBe(0);
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM credit_installments WHERE canceled_at IS NOT NULL",
        )
        .get()?.n,
    ).toBe(10);
  } finally {
    clock.mockRestore();
  }
});
it("rolls back annual schedules with ledger failure and rejects missing confirmed annual dates", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(annualStart);
  try {
    order("stripe", "year_new");
    db.exec(
      "UPDATE orders SET payment_mode='subscription',billing_interval='year' WHERE id='o'",
    );
    const state = {
      orderId: "o",
      userId: "u",
      subscriptionId: "s",
      status: "ACTIVE" as const,
      updatedAt: annualStart,
    };
    await expect(
      applyReconciliation("stripe", {
        subscriptions: [state],
        payments: [
          { ...payment, subscriptionId: "s", coveredUntil: annualEnd },
        ],
      }),
    ).rejects.toThrow("annual payment period");
    expect(balance()).toBe(0);
    db.exec(
      "CREATE TRIGGER reject_installment BEFORE INSERT ON credit_ledger WHEN NEW.id LIKE 'installment:%' BEGIN SELECT RAISE(ABORT,'ledger fail'); END;",
    );
    await expect(
      applyReconciliation("stripe", {
        payments: [
          {
            ...payment,
            subscriptionId: "s",
            coveredFrom: annualStart,
            coveredUntil: annualEnd,
          },
        ],
      }),
    ).rejects.toThrow("ledger fail");
    expect(db.prepare("SELECT COUNT(*) AS n FROM receipts").get()?.n).toBe(0);
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM credit_installments").get()?.n,
    ).toBe(0);
  } finally {
    clock.mockRestore();
  }
});
