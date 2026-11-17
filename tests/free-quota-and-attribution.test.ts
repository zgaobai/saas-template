import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  userId: "admin" as string | null,
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({ bindings: () => state.env }));
vi.mock("@/modules/auth/server/auth", () => ({
  auth: () => ({
    api: {
      getSession: async () =>
        state.userId ? { user: { id: state.userId } } : null,
    },
  }),
}));

import {
  getFreeQuotaStatus,
  setFreeQuotaConfig,
  ensureWallet,
  balance,
  getStartOfDayUtc8,
} from "@/modules/credits/server/service";
import {
  recordUserAttribution,
  getUserAttribution,
} from "@/modules/attribution/server/service";
import { detectChannel } from "@/modules/attribution/client";
import { listAdminOrders, adminOverview } from "@/modules/admin/server/queries";

let db: DatabaseSync;

function statement(sql: string, args: any[] = []): any {
  return {
    sql,
    args,
    bind: (...bindArgs: any[]) => statement(sql, bindArgs),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => {
      const res = db.prepare(sql).run(...args);
      return { meta: { changes: res.changes } };
    },
  };
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=OFF");

  const files = readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  }

  // Setup admin user and regular users
  db.prepare(`
    INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
    VALUES ('admin', 'Admin', 'admin@example.com', 1, 1000, 1000)
  `).run();

  state.env = {
    DB: {
      prepare: statement,
      batch: async (items: any[]) => {
        db.exec("BEGIN");
        try {
          const results = items.map((s: any) => {
            const sql = s.sql || s;
            const args = s.args || [];
            const stmt = db.prepare(sql);
            const isSelect = sql.trim().toUpperCase().startsWith("SELECT");
            if (isSelect) {
              const rows = stmt.all(...args);
              return { results: rows };
            }
            const res = stmt.run(...args);
            return { meta: { changes: res.changes } };
          });
          db.exec("COMMIT");
          return results;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
    ADMIN_USER_IDS: "admin",
    ADMIN_EMAIL: "admin@example.com",
  };
  state.userId = "admin";
});

describe("Daily Free Quota Cap & Switch (Requirement 1)", () => {
  it("defaults to enabled with limit of 100", async () => {
    const status = await getFreeQuotaStatus();
    expect(status.enabled).toBe(true);
    expect(status.dailyLimit).toBe(100);
    expect(status.todayGranted).toBe(0);
    expect(status.remainingToday).toBe(100);
    expect(status.isCappedToday).toBe(false);
  });

  it("admin can configure daily limit and toggle switch", async () => {
    await setFreeQuotaConfig({ enabled: false, dailyLimit: 50 }, "admin");
    let status = await getFreeQuotaStatus();
    expect(status.enabled).toBe(false);
    expect(status.dailyLimit).toBe(50);

    // Re-enable
    await setFreeQuotaConfig({ enabled: true }, "admin");
    status = await getFreeQuotaStatus();
    expect(status.enabled).toBe(true);
    expect(status.dailyLimit).toBe(50);
  });

  it("stops granting free credits once today's cap is reached", async () => {
    // Set daily limit to 2
    await setFreeQuotaConfig({ dailyLimit: 2 }, "admin");

    // Add user 1
    db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('u1','U1','u1@test.com',1,1000,1000)").run();
    await ensureWallet("u1");
    const bal1 = await balance("u1");
    expect(bal1).toBeGreaterThan(0); // Granted!

    // Add user 2
    db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('u2','U2','u2@test.com',1,1000,1000)").run();
    await ensureWallet("u2");
    const bal2 = await balance("u2");
    expect(bal2).toBeGreaterThan(0); // Granted!

    const statusAfter2 = await getFreeQuotaStatus();
    expect(statusAfter2.todayGranted).toBe(2);
    expect(statusAfter2.remainingToday).toBe(0);
    expect(statusAfter2.isCappedToday).toBe(true);

    // Add user 3 on the same day -> Cap reached, no more credits!
    db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('u3','U3','u3@test.com',1,1000,1000)").run();
    await ensureWallet("u3");
    const bal3 = await balance("u3");
    expect(bal3).toBe(0); // Not granted!

    // Check credit_ledger reason for u3
    const ledgerEntry = db.prepare("SELECT amount, reason FROM credit_ledger WHERE user_id='u3'").get() as any;
    expect(ledgerEntry.amount).toBe(0);
    expect(ledgerEntry.reason).toContain("上限");
  });

  it("stops granting when admin pauses the switch", async () => {
    await setFreeQuotaConfig({ enabled: false }, "admin");

    db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('u4','U4','u4@test.com',1,1000,1000)").run();
    await ensureWallet("u4");
    const bal = await balance("u4");
    expect(bal).toBe(0);

    const ledgerEntry = db.prepare("SELECT amount, reason FROM credit_ledger WHERE user_id='u4'").get() as any;
    expect(ledgerEntry.amount).toBe(0);
    expect(ledgerEntry.reason).toContain("暂停");
  });

  it("calculates UTC+8 day start accurately", () => {
    const testTimestamp = new Date("2026-11-17T14:30:00Z").getTime();
    const dayStart = getStartOfDayUtc8(testTimestamp);
    // 2026-11-17 14:30 UTC is 2026-11-17 22:30 UTC+8
    // Midnight UTC+8 is 2026-11-17 00:00:00 UTC+8 = 2026-11-16 16:00:00 UTC
    const expected = new Date("2026-11-16T16:00:00Z").getTime();
    expect(dayStart).toBe(expected);
  });
});

describe("Attribution Tracking & ChatGPT Special Statistics (Requirement 2)", () => {
  it("detects ChatGPT from utm_source, utm_medium, utm_campaign and referrer", () => {
    const fromUtmSource = detectChannel({ utmSource: "chatgpt" });
    expect(fromUtmSource.channel).toBe("ai_chatgpt");

    const fromUtmOpenAi = detectChannel({ utmSource: "openai" });
    expect(fromUtmOpenAi.channel).toBe("ai_chatgpt");

    const fromReferrer = detectChannel({ referrerHost: "chatgpt.com" });
    expect(fromReferrer.channel).toBe("ai_chatgpt");

    const fromReferrerOld = detectChannel({ referrerHost: "chat.openai.com" });
    expect(fromReferrerOld.channel).toBe("ai_chatgpt");
  });

  it("persists attribution into both user_attributions and user table upon registration", async () => {
    db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('cg1','CG1','cg1@test.com',1,1000,1000)").run();

    await recordUserAttribution("cg1", {
      channel: "ai_chatgpt",
      source: "chatgpt",
      medium: "ai_search",
      campaign: "promo_launch",
      landingPath: "/zh/tools/copywriting",
      referrerUrl: "https://chatgpt.com/",
    });

    // Check user_attributions
    const attrRecord = await getUserAttribution("cg1");
    expect(attrRecord).toBeDefined();
    expect(attrRecord?.channel).toBe("ai_chatgpt");
    expect(attrRecord?.source).toBe("chatgpt");
    expect(attrRecord?.landing_path).toBe("/zh/tools/copywriting");

    // Check user table columns
    const userRow = db.prepare("SELECT attribution_channel, attribution_source, attribution_landing_path, attribution_referrer_url FROM user WHERE id='cg1'").get() as any;
    expect(userRow.attribution_channel).toBe("ai_chatgpt");
    expect(userRow.attribution_source).toBe("chatgpt");
    expect(userRow.attribution_landing_path).toBe("/zh/tools/copywriting");
    expect(userRow.attribution_referrer_url).toBe("https://chatgpt.com/");
  });

  it("attributes orders to user acquisition source and supports filtering by channel", async () => {
    db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('payer1','Payer1','payer1@test.com',1,1000,1000)").run();
    await recordUserAttribution("payer1", {
      channel: "ai_chatgpt",
      source: "chatgpt",
      landingPath: "/zh/tools/copywriting",
    });

    db.prepare(`
      INSERT INTO orders (id, user_id, plan_id, plan_name, provider, amount, currency, credits, status, created_at)
      VALUES ('order_cg_1', 'payer1', 'pack', '灵感补给', 'pancake', 1900, 'USD', 100, 'paid', 2000)
    `).run();

    const ordersPage = await listAdminOrders(new Request("https://app.test/api/app/admin/orders"));
    expect(ordersPage.items.length).toBeGreaterThan(0);
    const order = ordersPage.items.find((o) => o.id === "order_cg_1");
    expect(order).toBeDefined();
    expect(order?.attribution_channel).toBe("ai_chatgpt");
    expect(order?.attribution_source).toBe("chatgpt");
    expect(order?.attribution_landing_path).toBe("/zh/tools/copywriting");

    // Search by "chatgpt" matches this order
    const filtered = await listAdminOrders(new Request("https://app.test/api/app/admin/orders?search=chatgpt"));
    expect(filtered.items.some((o) => o.id === "order_cg_1")).toBe(true);
  });

  it("adminOverview computes dedicated ChatGPT analytics", async () => {
    const now = Date.now();
    // User from ChatGPT within timeframe
    db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('cg_user_1','CG User','cg@test.com',1,?,?)").run(now - 10000, now - 10000);
    await recordUserAttribution("cg_user_1", {
      channel: "ai_chatgpt",
      source: "chatgpt",
      landingPath: "/zh/tools/copywriting",
    });

    // ChatGPT user pays
    db.prepare(`
      INSERT INTO orders (id, user_id, plan_id, plan_name, provider, amount, currency, credits, status, created_at)
      VALUES ('order_cg_paid', 'cg_user_1', 'pack', '灵感补给', 'pancake', 2900, 'USD', 200, 'paid', ?)
    `).run(now - 5000);

    const overview = await adminOverview(new Request("https://app.test/api/app/admin/overview?days=30"));
    expect(overview.chatgptStats).toBeDefined();
    expect(overview.chatgptStats?.usersCount).toBeGreaterThanOrEqual(1);
    expect(overview.chatgptStats?.paidOrdersCount).toBeGreaterThanOrEqual(1);
    expect(overview.chatgptStats?.payingUsersCount).toBeGreaterThanOrEqual(1);
    expect(overview.chatgptStats?.conversionRate).toBe("100.0%");
    expect(overview.chatgptStats?.revenue.some((r) => r.currency === "USD" && r.amount === 2900)).toBe(true);
    expect(overview.chatgptStats?.landingPages.some((lp) => lp.landing_path === "/zh/tools/copywriting")).toBe(true);

    // Free quota is also reported in overview
    expect(overview.freeQuota).toBeDefined();
    expect(overview.freeQuota?.dailyLimit).toBeGreaterThan(0);
  });
});
