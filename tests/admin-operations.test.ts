import {
  grantDueInstallments,
  monthlyDate,
  nextCreditGrant,
} from "@/modules/billing/server/installments";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  userId: "admin" as string | null,
  create: vi.fn(),
  validate: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => state.env,
  publicCapabilities: () => ({ ai: false }),
}));
vi.mock("@/modules/auth/server/auth", () => ({
  auth: () => ({
    api: {
      getSession: async () =>
        state.userId
          ? {
              user: { id: state.userId, email: state.userId + "@example.test" },
            }
          : null,
    },
  }),
}));
vi.mock("@/modules/billing/server/providers/registry", () => ({
  paymentProvider: (id = "stripe") => ({
    id,
    validateCheckout: state.validate,
    createCheckout: state.create,
    syncCheckout: state.sync,
  }),
}));
import * as codeVault from "@/modules/redemption/server/code-vault";
import {
  codeHash,
  createCode,
  redeem,
  setCodeStatus,
} from "@/modules/redemption/server/service";
import { setUserStatus, updatePlan } from "@/modules/admin/server/actions";
import { getPlan } from "@/modules/billing/server/plans";
import { ensureWallet } from "@/modules/credits/server/service";
import { currentEntitlement } from "@/modules/entitlements/server/service";
import { requireUser } from "@/modules/auth/server/session";
import { checkout } from "@/modules/billing/server/service";
import { applyReconciliation } from "@/modules/billing/server/reconciliation";
import { personalLedger } from "@/modules/account/server/ledger";
import { listHistory } from "@/modules/history/server/service";
import {
  adminUserDetail,
  adminUserRecords,
  listAdminUsers,
  listAdminTasks,
  taskDetail,
  listAdminLedger,
  listAdminCodes,
  listAdminRedemptions,
  adminOverview,
} from "@/modules/admin/server/queries";
let db: DatabaseSync;
const now = Date.UTC(2026, 9, 16, 2);
function statement(sql: string, args: any[] = []): any {
  return {
    sql,
    args,
    bind: (...values: any[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({
      meta: { changes: db.prepare(sql).run(...args).changes },
    }),
  };
}
const request = (data: unknown) =>
  new Request("https://app.test/action", {
    method: "POST",
    body: JSON.stringify(data),
  });
const query = (search = "") => new Request("https://app.test/?" + search);
const credit = (u: string) =>
  Number(
    db.prepare("SELECT balance FROM wallets WHERE user_id=?").get(u)?.balance ??
      0,
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const f of readdirSync("migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("migrations/" + f, "utf8"));
  for (const id of ["admin", "alice", "bob"])
    db.prepare(
      "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)",
    ).run(id, id, id + "@example.test", now, now);
  state.userId = "admin";
  state.env = {
    ADMIN_USER_IDS: "admin",
    REDEMPTION_ENCRYPTION_KEY: "a".repeat(64),
    DB: {
      prepare: statement,
      batch: async (items: any[]) => {
        db.exec("BEGIN");
        try {
          const results = items.map((s) => {
            const rows = db.prepare(s.sql).all(...s.args);
            return {
              results: rows,
              meta: {
                changes: Number(db.prepare("SELECT changes() AS n").get()!.n),
              },
            };
          });
          db.exec("COMMIT");
          return results;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
  };
  state.create.mockResolvedValue({
    providerId: "cs-test",
    url: "https://checkout.stripe.com/test",
  });
});
afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});
async function code(overrides: Record<string, unknown> = {}) {
  return createCode(
    request({
      requestId: crypto.randomUUID(),
      name: "测试兑换",
      kind: "credits",
      credits: 80,
      maxUses: 1,
      expiresAt: now + 86400000,
      ...overrides,
    }),
  );
}
async function savePlan(id = "pack", changes: Record<string, unknown> = {}) {
  const p = await getPlan(id);
  const { mode, ...edit } = p;
  return updatePlan(request({ ...edit, ...changes }));
}
function task(id: string, user = "alice", status = "completed", time = now) {
  db.prepare(
    "INSERT INTO generations(id,user_id,prompt,tone,tool_id,status,cost,created_at,completed_at,error_code,output) VALUES (?,?,'input','natural','copywriting',?,1,?,?,?,?)",
  ).run(
    id,
    user,
    status,
    time,
    status === "pending" ? null : time,
    status === "failed" ? "generation_failed" : null,
    status === "completed" ? "result" : null,
  );
}
describe("atomic redemption", () => {
  it("keeps user balance, entitlement, ledger and admin records consistent after plan redemption", async () => {
    const c = await code({ kind: "plan", planId: "creator" });
    const r = await redeem(request({ code: c.code }), "alice");
    const user = await personalLedger(query(), "alice");
    const entitlement = await currentEntitlement("alice");
    const adminUser = await listAdminUsers(query("search=alice"));
    const adminLedger = await listAdminLedger(query("search=alice"));
    const history = await listAdminRedemptions(query("search=alice"));
    const codes = await listAdminCodes(query("search=" + c.id));
    expect(user.balance).toBe(520);
    expect(user.summary).toMatchObject({ earned: 520, spent: 0, returned: 0 });
    expect(user.items.find((i) => i.id === "redeem:" + r.id)?.amount).toBe(500);
    expect(entitlement).toMatchObject({
      plan_id: "creator",
      plan_name: "创作者",
      paid_until: r.expires_at,
      status: "REDEEMED",
    });
    expect(r.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(("redeem:" + r.id).length).toBe(29);
    expect(r.expires_at).toBe(monthlyDate(now, 1));
    expect(await nextCreditGrant("alice")).toBeNull();
    expect(adminUser.items[0].balance).toBe(user.balance);
    expect(
      adminLedger.items.find((i) => i.id === "redeem:" + r.id)?.amount,
    ).toBe(500);
    expect(history.items[0]).toMatchObject({
      id: r.id,
      email: "alice@example.test",
      code: c.code,
      code_status: "ready",
      plan_name: "创作者",
      credits: 500,
      expires_at: r.expires_at,
      created_at: now,
    });
    expect(history.items[0]).not.toHaveProperty("code_ciphertext");
    expect(history.items[0]).not.toHaveProperty("code_hash");
    const searchedHistory = await listAdminRedemptions(
      query("search=" + c.code.toLowerCase()),
    );
    expect(searchedHistory.items).toHaveLength(1);
    expect(searchedHistory.items[0].id).toBe(r.id);
    const userHistory = (
      await adminUserRecords(query(), "alice", "redemptions")
    ).items[0];
    expect(userHistory).toMatchObject({
      email: "alice@example.test",
      code: c.code,
      credits: 500,
      created_at: now,
    });
    expect(userHistory).not.toHaveProperty("code_ciphertext");
    expect(codes.items[0].used).toBe(1);
    const detail = await adminUserDetail(query(), "alice");
    expect(detail.user.balance).toBe(520);
    expect(detail.entitlement?.paid_until).toBe(r.expires_at);
    expect(
      (await adminUserRecords(query(), "alice", "redemptions")).items[0]
        .credits,
    ).toBe(500);
    expect(
      (await adminUserRecords(query(), "alice", "ledger")).items.some(
        (i) => i.id === "redeem:" + r.id,
      ),
    ).toBe(true);
    expect(
      (await adminUserRecords(query(), "bob", "redemptions")).items,
    ).toEqual([]);
    await redeem(request({ code: c.code }), "alice");
    expect((await personalLedger(query(), "alice")).balance).toBe(520);
    expect((await currentEntitlement("alice"))?.paid_until).toBe(r.expires_at);
    vi.spyOn(Date, "now").mockReturnValue(r.expires_at + 1);
    expect(await currentEntitlement("alice")).toBeNull();
    expect((await personalLedger(query(), "alice")).balance).toBe(520);
  });

  it("grants once on repeated and concurrent submissions, with ledger and audit", async () => {
    const c = await code();
    const outcomes = await Promise.all([
      redeem(request({ code: c.code }), "alice"),
      redeem(request({ code: c.code.toLowerCase() }), "alice"),
    ]);
    expect(outcomes.every((r) => r.credits === 80)).toBe(true);
    expect(credit("alice")).toBe(100);
    expect(db.prepare("SELECT used FROM redeem_codes").get()?.used).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM redemptions").get()?.n).toBe(
      1,
    );
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM credit_ledger WHERE id LIKE 'redeem:%'",
        )
        .get()?.n,
    ).toBe(1);
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_logs WHERE action LIKE 'code.redeemed:%'",
        )
        .get()?.n,
    ).toBe(1);
  });
  it("keeps legacy composite redemption IDs idempotent after switching new IDs", async () => {
    const c = await code();
    await ensureWallet("alice");
    const legacyId = c.id + ":alice";
    db.prepare(
      "INSERT INTO redemptions(id,code_id,user_id,credits,plan_id,plan_name,expires_at,created_at) VALUES (?,?,'alice',80,NULL,NULL,0,?)",
    ).run(legacyId, c.id, now);
    const retry = await redeem(request({ code: c.code }), "alice");
    expect(retry.id).toBe(legacyId);
    expect(retry.alreadyRedeemed).toBe(true);
    expect(credit("alice")).toBe(100);
    expect(
      db.prepare("SELECT used FROM redeem_codes WHERE id=?").get(c.id)?.used,
    ).toBe(1);
  });
  it("allows only one user to claim the last slot under concurrent requests", async () => {
    const c = await code();
    const result = await Promise.allSettled([
      redeem(request({ code: c.code }), "alice"),
      redeem(request({ code: c.code }), "bob"),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(db.prepare("SELECT used FROM redeem_codes").get()?.used).toBe(1);
    expect(
      db
        .prepare(
          "SELECT SUM(amount) AS n FROM credit_ledger WHERE id LIKE 'redeem:%'",
        )
        .get()?.n,
    ).toBe(80);
  });
  it("rejects expired, disabled, unknown and exhausted codes without reward", async () => {
    const c = await code();
    await setCodeStatus(request({ id: c.id, disabled: true }));
    await expect(
      redeem(request({ code: c.code }), "alice"),
    ).rejects.toMatchObject({ status: 409 });
    await setCodeStatus(request({ id: c.id, disabled: false }));
    db.prepare("UPDATE redeem_codes SET expires_at=? WHERE id=?").run(
      now - 1,
      c.id,
    );
    await expect(
      redeem(request({ code: c.code }), "alice"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      redeem(request({ code: "X".repeat(34) }), "alice"),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM redemptions").get()?.n).toBe(
      0,
    );
  });
  it("snapshots package rewards and extends same-plan access without creating paid subscription", async () => {
    const first = await code({
      kind: "plan",
      planId: "creator",
      maxUses: 1,
    });
    await savePlan("creator", { credits: 900, name: "新套餐" });
    const r = await redeem(request({ code: first.code }), "alice");
    expect(r.credits).toBe(500);
    expect(r.plan_name).toBe("创作者");
    expect(r.expires_at).toBe(monthlyDate(now, 1));
    const second = await code({ kind: "plan", planId: "creator" });
    await redeem(request({ code: second.code }), "alice");
    const entitlement = await currentEntitlement("alice");
    expect(entitlement?.paid_until).toBe(monthlyDate(now, 2));
    expect(entitlement?.status).toBe("REDEEMED");
    expect(credit("alice")).toBe(1420);
    expect(db.prepare("SELECT COUNT(*) AS n FROM subscriptions").get()?.n).toBe(
      0,
    );
    expect(await currentEntitlement("bob")).toBeNull();
  });
  it("rolls back capacity and redemption if reward ledger insertion fails", async () => {
    const c = await code();
    db.exec(
      "CREATE TRIGGER test_reject_reward BEFORE INSERT ON credit_ledger WHEN NEW.id LIKE 'redeem:%' BEGIN SELECT RAISE(ABORT,'test failure'); END;",
    );
    await expect(
      redeem(request({ code: c.code }), "alice"),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.prepare("SELECT used FROM redeem_codes").get()?.used).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM redemptions").get()?.n).toBe(
      0,
    );
  });
  it("enforces single use while keeping redeemed codes readable to administrators", async () => {
    await expect(code({ maxUses: 2 })).rejects.toMatchObject({ status: 400 });
    const c = await code();
    db.prepare("UPDATE redeem_codes SET max_uses=10 WHERE id=?").run(c.id);
    await redeem(request({ code: c.code }), "alice");
    await expect(
      redeem(request({ code: c.code }), "bob"),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await redeem(request({ code: c.code }), "alice")).alreadyRedeemed,
    ).toBe(true);
    expect(
      (await listAdminCodes(query("search=" + c.code))).items[0],
    ).toMatchObject({ code: c.code, code_status: "ready", used: 1 });
    expect(
      (await listAdminCodes(query("status=available"))).items,
    ).toHaveLength(0);
    await expect(
      setCodeStatus(request({ id: c.id, disabled: false })),
    ).rejects.toMatchObject({ status: 409 });
    expect(credit("alice")).toBe(100);
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM redemptions WHERE code_id=?")
        .get(c.id)?.n,
    ).toBe(1);
  });
  it("keeps old long codes redeemable without pretending hashes can recover plaintext", async () => {
    const c = await code();
    const oldCode = "QH" + "F".repeat(32);
    db.prepare(
      "UPDATE redeem_codes SET code_hash=?,code_ciphertext=NULL WHERE id=?",
    ).run(codeHash(oldCode), c.id);
    expect((await listAdminCodes(query())).items[0]).toMatchObject({
      code: null,
      code_status: "legacy",
    });
    expect((await redeem(request({ code: oldCode }), "alice")).credits).toBe(
      80,
    );
  });
  it("binds encrypted codes to their record and fails closed if the key is missing or wrong", async () => {
    const a = await code(),
      b = await code();
    const cipher = db
      .prepare("SELECT code_ciphertext FROM redeem_codes WHERE id=?")
      .get(a.id)!.code_ciphertext as string;
    expect(() => codeVault.decryptCode(cipher, b.id)).toThrow();
    state.env.REDEMPTION_ENCRYPTION_KEY = "b".repeat(64);
    expect(
      (await listAdminCodes(query())).items.every(
        (r) => r.code === null && r.code_status === "unavailable",
      ),
    ).toBe(true);
    delete state.env.REDEMPTION_ENCRYPTION_KEY;
    await expect(code()).rejects.toMatchObject({ status: 503 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM redeem_codes").get()?.n).toBe(
      2,
    );
  });
  it("retries short-code collisions and never reuses existing codes", async () => {
    const generator = vi
      .spyOn(codeVault, "generateCode")
      .mockReturnValueOnce("K7M9Q2")
      .mockReturnValueOnce("K7M9Q2")
      .mockReturnValueOnce("H8N6R3");
    const first = await code(),
      second = await code();
    expect([first.code, second.code]).toEqual(["K7M9Q2", "H8N6R3"]);
    generator.mockReturnValue("K7M9Q2");
    await expect(code()).rejects.toMatchObject({ status: 503 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM redeem_codes").get()?.n).toBe(
      2,
    );
  });
  it("stores encrypted codes and reveals plaintext only in authorized admin listings", async () => {
    const c = await code();
    const raw = db.prepare("SELECT * FROM redeem_codes").get();
    expect(JSON.stringify(raw)).not.toContain(c.code);
    const list = await listAdminCodes(query());
    expect(list.items[0]).not.toHaveProperty("code_hash");
    expect(list.items[0]).not.toHaveProperty("code_ciphertext");
    expect(list.items[0].code).toBe(c.code);
    expect(c.code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
  });
});
describe("plans, orders and account controls", () => {
  it("uses configured welcome credits once, with no retroactive balance changes", async () => {
    await ensureWallet("alice");
    await savePlan("starter", { credits: 35 });
    await ensureWallet("alice");
    await ensureWallet("bob");
    expect(credit("alice")).toBe(20);
    expect(credit("bob")).toBe(35);
  });
  it("rejects stale plan updates and preserves audit only for committed revisions", async () => {
    await savePlan("pack", { price: 1200 });
    await expect(
      savePlan("pack", { revision: 1, price: 999 }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getPlan("pack")).price).toBe(1200);
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_logs WHERE action LIKE 'plan.updated:%'",
        )
        .get()?.n,
    ).toBe(1);
  });
  it("uses current plan for checkout and frozen order values for subsequent payment", async () => {
    await savePlan("pack", { price: 1200, credits: 250, name: "新版积分包" });
    const p = await getPlan("pack"),
      id = crypto.randomUUID();
    await checkout(
      request({ planId: "pack", requestId: id, planRevision: p.revision }),
      { id: "alice", email: "alice@example.test" },
    );
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1200,
        credits: 250,
        name: "新版积分包",
      }),
    );
    await savePlan("pack", { price: 1500, credits: 300 });
    await applyReconciliation("stripe", {
      payments: [
        {
          orderId: id.replaceAll("-", ""),
          userId: "alice",
          paymentId: "payment-test",
          amount: 1200,
          currency: "USD",
        },
      ],
    });
    expect(credit("alice")).toBe(270);
    expect(
      db.prepare("SELECT amount,credits,plan_name FROM orders").get(),
    ).toMatchObject({ amount: 1200, credits: 250, plan_name: "新版积分包" });
    await expect(
      checkout(
        request({
          planId: "pack",
          requestId: crypto.randomUUID(),
          planRevision: 1,
        }),
        { id: "bob", email: "bob@example.test" },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("prevents purchase of disabled plans and prevents disabling administrators", async () => {
    await savePlan("pack", { enabled: false });
    await expect(
      checkout(request({ planId: "pack", requestId: crypto.randomUUID() }), {
        id: "alice",
        email: "alice@example.test",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.create).not.toHaveBeenCalled();
    await expect(
      setUserStatus(
        request({ userId: "admin", disabled: true, reason: "测试停用" }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("revokes sessions and denies service for disabled users, then restores access", async () => {
    db.prepare(
      "INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES ('s',?,'token',?,?,'alice')",
    ).run(now + 10000, now, now);
    await setUserStatus(
      request({ userId: "alice", disabled: true, reason: "测试停用" }),
    );
    expect(db.prepare("SELECT COUNT(*) AS n FROM session").get()?.n).toBe(0);
    state.userId = "alice";
    await expect(requireUser(query())).rejects.toMatchObject({ status: 403 });
    expect(() =>
      db
        .prepare(
          "INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES ('s',?,'token',?,?,'alice')",
        )
        .run(now + 10000, now, now),
    ).toThrow("account_disabled");
    state.userId = "admin";
    await setUserStatus(
      request({ userId: "alice", disabled: false, reason: "恢复测试" }),
    );
    state.userId = "alice";
    await expect(requireUser(query())).resolves.toMatchObject({ id: "alice" });
  });
  it("blocks ordinary users from all new management writes and reads", async () => {
    state.userId = "alice";
    for (const fn of [createCode, setCodeStatus, updatePlan, setUserStatus])
      await expect(fn(request({}))).rejects.toMatchObject({ status: 403 });
    for (const fn of [
      listAdminTasks,
      listAdminLedger,
      listAdminCodes,
      listAdminRedemptions,
      adminOverview,
    ])
      await expect(fn(query())).rejects.toMatchObject({ status: 403 });
    await expect(taskDetail(query(), "task")).rejects.toMatchObject({
      status: 403,
    });
  });
});
describe("operational views and ownership", () => {
  it("isolates personal ledger and task history while administrator can see all", async () => {
    await ensureWallet("alice");
    await ensureWallet("bob");
    task("a", "alice", "failed");
    task("b", "bob");
    db.prepare(
      "INSERT INTO credit_ledger VALUES ('generation:a','alice',-1,'预扣',?)",
    ).run(now);
    db.prepare(
      "INSERT INTO credit_ledger VALUES ('release:a','alice',1,'失败退回',?)",
    ).run(now);
    const ledger = await personalLedger(query(), "alice");
    expect(ledger.summary).toMatchObject({ spent: 1, returned: 1, earned: 20 });
    expect(ledger.items.every((i) => !i.id.includes("bob"))).toBe(true);
    const history = await listHistory(query("status=failed"), "alice");
    expect(history.history).toHaveLength(1);
    expect(history.history[0]).toMatchObject({ id: "a", refunded: 1, cost: 1 });
    expect(
      (await listHistory(query("status=completed"), "alice")).history,
    ).toHaveLength(0);
    expect((await listAdminTasks(query())).items).toHaveLength(2);
    expect((await taskDetail(query(), "a")).prompt).toBe("input");
    const overview = await adminOverview(query("days=7"));
    expect(overview.tasks).toMatchObject({ count: 2, completed: 1, failed: 1 });
    expect(overview.credits).toMatchObject({ issued: 41, spent: 1 });
  });
  it("bounds dashboard period and ignores out-of-period activity", async () => {
    task("old", "alice", "completed", now - 40 * 86400000);
    task("new", "bob");
    const data = await adminOverview(query("days=30"));
    expect(data.tasks.count).toBe(1);
    await expect(adminOverview(query("days=365"))).rejects.toMatchObject({
      status: 400,
    });
  });
});

it("dashboard separates receipt revenue from order totals and counts refunds by event time", async () => {
  db.prepare(
    "INSERT INTO orders(id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES ('o','alice','pack','stripe',1200,'USD',200,'paid',?)",
  ).run(now);
  db.prepare("INSERT INTO wallets VALUES ('alice',0)").run();
  db.prepare(
    "INSERT INTO receipts(id,order_id,user_id,provider_id,amount,credits,created_at) VALUES ('r','o','alice','p',1200,200,?)",
  ).run(now);
  db.prepare(
    "INSERT INTO credit_ledger VALUES ('payment:r','alice',200,'购买积分',?)",
  ).run(now);
  db.prepare("INSERT INTO refund_events VALUES ('refund:r','r',300,?)").run(
    now,
  );
  const report = await adminOverview(query("days=7"));
  expect(report.revenue).toEqual([
    { currency: "USD", received: 1200, refunded: 300 },
  ]);
  const ledger = await listAdminLedger(query("search=alice"));
  expect(ledger.items.filter((i) => i.order_id === "o")).toHaveLength(2);
});
it("redemption honors paid subscription expiry and does not grant pack expiry", async () => {
  db.prepare(
    "INSERT INTO orders(id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES ('o','alice','creator','stripe',1900,'USD',500,'paid',?)",
  ).run(now);
  db.prepare(
    "INSERT INTO subscriptions(id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at) VALUES ('s','alice','o','s-remote','creator','ACTIVE',?,?)",
  ).run(now + 5 * 86400000, now);
  const c = await code({ kind: "plan", planId: "creator" });
  const redeemed = await redeem(request({ code: c.code }), "alice");
  expect(redeemed.expires_at).toBe(monthlyDate(now + 5 * 86400000, 1));
  const pack = await code({ kind: "plan", planId: "pack" });
  expect((await redeem(request({ code: pack.code }), "bob")).expires_at).toBe(
    0,
  );
});

it("creates multiple paid plans, exposes public prices without bindings and snapshots checkout contracts", async () => {
  const base = {
    requestId: crypto.randomUUID(),
    name: "专业版",
    mode: "subscription",
    interval: "month",
    price: 1990,
    annualPrice: 19900,
    credits: 800,
    description: "每月积分",
    features: ["完整工具"],
    enabled: true,
    paymentBindings: { stripe: "price_month_pro" },
    annualPaymentBindings: { stripe: "price_year_pro" },
  };
  const created = await updatePlan(request(base), true);
  expect((await updatePlan(request(base), true)).id).toBe(created.id);
  const p = await getPlan(created.id!);
  expect(p).toMatchObject({
    interval: "month",
    credits: 800,
    paymentBindings: { stripe: "price_month_pro" },
    annualPaymentBindings: { stripe: "price_year_pro" },
  });
  const { getPublicPlans } = await import("@/modules/billing/server/plans");
  const publicPlan = (await getPublicPlans()).find((p) => p.id === created.id)!;
  expect(publicPlan.price).toBe(1990);
  expect(publicPlan.annualPrice).toBe(19900);
  expect(publicPlan).not.toHaveProperty("paymentBindings");
  await checkout(
    request({
      planId: p.id,
      interval: "year",
      planRevision: 1,
      requestId: crypto.randomUUID(),
    }),
    { id: "alice", email: "alice@example.test" },
  );
  expect(state.create).toHaveBeenCalledWith(
    expect.objectContaining({
      planId: p.id,
      interval: "year",
      productRef: "price_year_pro",
      amount: 19900,
      credits: 800,
    }),
  );
  const order = db.prepare("SELECT * FROM orders WHERE plan_id=?").get(p.id)!;
  await updatePlan(
    request({
      ...p,
      name: "新名称",
      price: 2490,
      annualPrice: 24900,
      credits: 900,
      annualPaymentBindings: { stripe: "price_year_new" },
    }),
  );
  expect(
    db
      .prepare(
        "SELECT amount,credits,billing_interval,product_ref FROM orders WHERE id=?",
      )
      .get(order.id! as string),
  ).toEqual({
    amount: 19900,
    credits: 800,
    billing_interval: "year",
    product_ref: "price_year_pro",
  });
  await expect(
    updatePlan(request({ ...(await getPlan(p.id)), interval: "year" })),
  ).rejects.toMatchObject({ status: 400 });
  const more = await updatePlan(
    request({ ...base, requestId: crypto.randomUUID(), name: "高级版" }),
    true,
  );
  expect(more.id).not.toBe(p.id);
  const pack = await updatePlan(
    request({
      ...base,
      requestId: crypto.randomUUID(),
      name: "大积分包",
      mode: "payment",
      interval: null,
      annualPrice: null,
      annualPaymentBindings: {},
      paymentBindings: { pancake: "PROD_pack_big" },
    }),
    true,
  );
  expect((await getPlan(pack.id!)).mode).toBe("payment");
});

describe("annual redemption installments", () => {
  async function annualCode() {
    db.prepare(
      "UPDATE plan_configs SET annual_price=19000,credits=100 WHERE id='creator'",
    ).run();
    return code({
      kind: "plan",
      planId: "creator",
      interval: "year",
    });
  }
  it("grants only the first month, exposes next grant, keeps snapshots and completes exactly twelve months", async () => {
    const c = await annualCode();
    expect(c.grantMonths).toBe(12);
    const r = await redeem(request({ code: c.code }), "alice");
    expect(r.expires_at).toBe(monthlyDate(now, 12));
    expect(credit("alice")).toBe(120);
    expect(await nextCreditGrant("alice")).toMatchObject({
      due_at: monthlyDate(now, 1),
      credits: 100,
      installment: 2,
    });
    expect(await nextCreditGrant("bob")).toBeNull();
    const history = await adminUserRecords(query(), "alice", "redemptions");
    expect(history.items[0]).toMatchObject({ grant_months: 12, credits: 100 });
    await savePlan("creator", { credits: 999 });
    await Promise.all([
      redeem(request({ code: c.code }), "alice"),
      redeem(request({ code: c.code }), "alice"),
    ]);
    await expect(redeem(request({ code: c.code }), "bob")).rejects.toThrow();
    expect(credit("alice")).toBe(120);
    await Promise.all([
      grantDueInstallments(monthlyDate(now, 1)),
      grantDueInstallments(monthlyDate(now, 1)),
    ]);
    expect(credit("alice")).toBe(220);
    await grantDueInstallments(monthlyDate(now, 15));
    expect(credit("alice")).toBe(1220);
    expect(await nextCreditGrant("alice")).toBeNull();
    expect(
      db
        .prepare(
          "SELECT COUNT(*) n FROM credit_ledger WHERE id LIKE 'redeem-month:%'",
        )
        .get()!.n,
    ).toBe(12);
  });
  it("keeps annual entitlement, balances, next grant and both ledgers synchronized through all installments", async () => {
    const c = await annualCode();
    const r = await redeem(request({ code: c.code }), "alice");
    async function verify(periods: number) {
      const user = await personalLedger(query(), "alice");
      const detail = await adminUserDetail(query(), "alice");
      const ledger = await adminUserRecords(query(), "alice", "ledger");
      const history = await listAdminRedemptions(query("search=alice"));
      expect(user.balance).toBe(20 + periods * 100);
      expect(detail.user.balance).toBe(user.balance);
      expect(detail.entitlement).toEqual(await currentEntitlement("alice"));
      expect(detail.entitlement?.paid_until).toBe(monthlyDate(now, 12));
      expect(history.items[0].expires_at).toBe(detail.entitlement?.paid_until);
      const grants = user.items.filter((i) =>
        i.id.startsWith("redeem-month:" + r.id + ":"),
      );
      expect(grants).toHaveLength(periods);
      expect(grants.reduce((sum, i) => sum + i.amount, 0)).toBe(periods * 100);
      expect(
        ledger.items.filter((i) =>
          i.id.startsWith("redeem-month:" + r.id + ":"),
        ),
      ).toEqual(grants);
      expect(await nextCreditGrant("alice")).toEqual(
        periods === 12
          ? null
          : {
              due_at: monthlyDate(now, periods),
              credits: 100,
              installment: periods + 1,
              plan_name: "创作者",
            },
      );
    }
    await verify(1);
    await redeem(request({ code: c.code }), "alice");
    await verify(1);
    for (let period = 2; period <= 12; period++) {
      vi.mocked(Date.now).mockReturnValue(monthlyDate(now, period - 1));
      await grantDueInstallments();
      await grantDueInstallments();
      await verify(period);
    }
  });
  it("queues another year after existing rights without issuing extra points immediately", async () => {
    const a = await annualCode(),
      b = await annualCode();
    const first = await redeem(request({ code: a.code }), "alice");
    const second = await redeem(request({ code: b.code }), "alice");
    expect(second.starts_at).toBe(first.expires_at);
    expect(second.expires_at).toBe(monthlyDate(now, 24));
    expect(credit("alice")).toBe(120);
    await grantDueInstallments(first.expires_at);
    expect(credit("alice")).toBe(1320);
    expect(await nextCreditGrant("alice")).toMatchObject({
      due_at: monthlyDate(now, 13),
      installment: 2,
    });
  });
  it("clamps month-end and leap dates while preserving the original day and milliseconds", async () => {
    for (const start of [
      Date.UTC(2028, 0, 31, 10, 5, 6, 789),
      Date.UTC(2028, 1, 29, 10, 5, 6, 789),
    ]) {
      vi.mocked(Date.now).mockReturnValue(now);
      const c = await code({ kind: "credits" });
      vi.mocked(Date.now).mockReturnValue(start);
      db.prepare(
        "UPDATE redeem_codes SET grant_months=12,plan_id='creator',plan_name='创作者',expires_at=? WHERE id=?",
      ).run(start + 86400000, c.id);
      const r = await redeem(
        request({ code: c.code }),
        start === Date.UTC(2028, 0, 31, 10, 5, 6, 789) ? "alice" : "bob",
      );
      const rows = db
        .prepare(
          "SELECT due_at FROM redemption_installments WHERE redemption_id=? ORDER BY installment",
        )
        .all(r.id);
      expect(rows.map((x) => x.due_at)).toEqual(
        Array.from({ length: 12 }, (_, i) => monthlyDate(start, i)),
      );
      expect(r.expires_at).toBe(monthlyDate(start, 12));
    }
  });
  it("rolls back the entire redemption on ledger failure and retries safely", async () => {
    const c = await annualCode();
    await ensureWallet("alice");
    db.exec(
      "CREATE TRIGGER fail_month BEFORE INSERT ON credit_ledger WHEN NEW.id LIKE 'redeem-month:%' BEGIN SELECT RAISE(ABORT,'test'); END;",
    );
    await expect(redeem(request({ code: c.code }), "alice")).rejects.toThrow();
    expect(
      db.prepare("SELECT used FROM redeem_codes WHERE id=?").get(c.id)!.used,
    ).toBe(0);
    expect(
      db.prepare("SELECT COUNT(*) n FROM redemption_installments").get()!.n,
    ).toBe(0);
    db.exec("DROP TRIGGER fail_month");
    await redeem(request({ code: c.code }), "alice");
    expect(credit("alice")).toBe(120);
  });
  it("stops grants for closed accounts and retries failed scheduled ledger writes", async () => {
    const c = await annualCode();
    await redeem(request({ code: c.code }), "alice");
    db.exec(
      "CREATE TRIGGER fail_month BEFORE INSERT ON credit_ledger WHEN NEW.id LIKE 'redeem-month:%' BEGIN SELECT RAISE(ABORT,'test'); END;",
    );
    await expect(grantDueInstallments(monthlyDate(now, 1))).rejects.toThrow();
    expect(credit("alice")).toBe(120);
    db.exec("DROP TRIGGER fail_month");
    await grantDueInstallments(monthlyDate(now, 1));
    expect(credit("alice")).toBe(220);
    db.prepare("UPDATE user SET closed_at=? WHERE id='alice'").run(now);
    await grantDueInstallments(monthlyDate(now, 12));
    expect(credit("alice")).toBe(220);
    expect(await nextCreditGrant("alice")).toBeNull();
  });
});

it("uses one plan with separate monthly/annual prices and bindings; isolates public data and snapshots selected billing", async () => {
  state.create.mockImplementation(async (input) => ({
    providerId: "cs-" + input.orderId,
    url: "https://checkout.stripe.com/" + input.orderId,
  }));
  await savePlan("creator", {
    price: 1900,
    annualPrice: 19000,
    paymentBindings: { stripe: "price_month" },
    annualPaymentBindings: { stripe: "price_year" },
  });
  const { getPublicPlans } = await import("@/modules/billing/server/plans");
  const publicPlan = (await getPublicPlans()).find((p) => p.id === "creator")!;
  expect(publicPlan.annualPrice).toBe(19000);
  expect(publicPlan).not.toHaveProperty("annualPaymentBindings");
  const id = crypto.randomUUID();
  await checkout(
    request({ planId: "creator", interval: "year", requestId: id }),
    { id: "alice", email: "alice@example.test" },
  );
  expect(state.create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      planId: "creator",
      amount: 19000,
      credits: 500,
      interval: "year",
      productRef: "price_year",
    }),
  );
  expect(
    db
      .prepare(
        "SELECT amount,billing_interval,product_ref,plan_id FROM orders WHERE id=?",
      )
      .get(id.replaceAll("-", "")),
  ).toMatchObject({
    amount: 19000,
    billing_interval: "year",
    product_ref: "price_year",
    plan_id: "creator",
  });
  await expect(
    checkout(request({ planId: "creator", interval: "month", requestId: id }), {
      id: "alice",
      email: "alice@example.test",
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    checkout(
      request({
        planId: "creator",
        interval: "month",
        requestId: crypto.randomUUID(),
      }),
      { id: "alice", email: "alice@example.test" },
    ),
  ).rejects.toMatchObject({ status: 409 });
  await checkout(
    request({
      planId: "creator",
      interval: "month",
      requestId: crypto.randomUUID(),
    }),
    { id: "bob", email: "bob@example.test" },
  );
  expect(state.create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      amount: 1900,
      credits: 500,
      interval: "month",
      productRef: "price_month",
    }),
  );
  await savePlan("creator", {
    annualPrice: 18000,
    annualPaymentBindings: { stripe: "price_new_year" },
  });
  await checkout(
    request({ planId: "creator", interval: "year", requestId: id }),
    { id: "alice", email: "alice@example.test" },
  );
  expect(
    db
      .prepare("SELECT amount,product_ref FROM orders WHERE id=?")
      .get(id.replaceAll("-", "")),
  ).toMatchObject({ amount: 19000, product_ref: "price_year" });
});
it("rejects unavailable annual options and never uses a monthly legacy product for annual checkout", async () => {
  await expect(
    checkout(
      request({
        planId: "creator",
        interval: "year",
        requestId: crypto.randomUUID(),
      }),
      { id: "alice", email: "alice@example.test" },
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    code({ kind: "plan", planId: "creator", interval: "year" }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    savePlan("creator", { annualPrice: 30000 }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(savePlan("pack", { annualPrice: 9000 })).rejects.toMatchObject({
    status: 400,
  });
  await savePlan("creator", {
    annualPrice: 19000,
    paymentBindings: { stripe: "price_month" },
    annualPaymentBindings: {},
  });
  await checkout(
    request({
      planId: "creator",
      interval: "year",
      requestId: crypto.randomUUID(),
    }),
    { id: "alice", email: "alice@example.test" },
  );
  expect(state.create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      amount: 19000,
      interval: "year",
      productRef: undefined,
    }),
  );
});
it("calculates annual discounts from actual monthly and yearly totals", async () => {
  const { annualSavings, supportsAnnual } =
    await import("@/modules/billing/plans");
  await savePlan("creator", { annualPrice: 19000 });
  const plan = await getPlan("creator");
  expect(annualSavings(plan)).toEqual({ amount: 3800, percent: 17 });
  expect(supportsAnnual(plan)).toBe(true);
  expect(annualSavings({ ...plan, annualPrice: 22800 })).toBeNull();
});

it("retires standalone annual plans from catalogs and new operations while preserving historical redemption and checkout", async () => {
  const c = await code({ kind: "plan", planId: "creator" });
  db.prepare(
    "UPDATE plan_configs SET billing_interval='year' WHERE id='creator'",
  ).run();
  const { getPlans, getPublicPlans } =
    await import("@/modules/billing/server/plans");
  expect((await getPlans()).some((p) => p.id === "creator")).toBe(false);
  expect((await getPublicPlans()).some((p) => p.id === "creator")).toBe(false);
  const legacy = await getPlan("creator");
  await expect(
    updatePlan(request({ ...legacy, revision: 1 })),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    updatePlan(
      request({ ...legacy, id: undefined, requestId: crypto.randomUUID() }),
      true,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    code({ kind: "plan", planId: "creator", interval: "year" }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    checkout(request({ planId: "creator", requestId: crypto.randomUUID() }), {
      id: "alice",
      email: "alice@example.test",
    }),
  ).rejects.toMatchObject({ status: 409 });
  const redeemed = await redeem(request({ code: c.code }), "alice");
  expect(redeemed.credits).toBe(500);
  expect(credit("alice")).toBe(520);
  const reqId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO orders(id,user_id,plan_id,provider,amount,currency,credits,status,created_at,payment_mode,billing_interval,checkout_url) VALUES (?,'alice','creator','stripe',1900,'USD',500,'pending',?,'subscription','year','https://checkout.stripe.com/existing')",
  ).run(reqId.replaceAll("-", ""), now);
  expect(
    await checkout(
      request({ planId: "creator", interval: "year", requestId: reqId }),
      { id: "alice", email: "alice@example.test" },
    ),
  ).toEqual({ url: "https://checkout.stripe.com/existing" });
});

describe("fixed redemption calendar terms", () => {
  it.each([
    Date.UTC(2027, 0, 31, 10, 5, 6, 789),
    Date.UTC(2028, 0, 31, 10, 5, 6, 789),
    Date.UTC(2028, 1, 29, 10, 5, 6, 789),
  ])(
    "grants one calendar month from %s and preserves milliseconds",
    async (start) => {
      vi.mocked(Date.now).mockReturnValue(start);
      const c = await code({
        kind: "plan",
        planId: "creator",
        interval: "month",
        expiresAt: start + 86400000,
      });
      expect(c.termMonths).toBe(1);
      const result = await redeem(request({ code: c.code }), "alice");
      expect(result.expires_at).toBe(monthlyDate(start, 1));
      expect(credit("alice")).toBe(520);
      expect(
        (await listAdminCodes(query("search=" + c.id))).items[0],
      ).toMatchObject({ term_months: 1, days: 0 });
      expect(
        db.prepare("SELECT COUNT(*) n FROM redemption_installments").get()!.n,
      ).toBe(0);
      await redeem(request({ code: c.code }), "alice");
      expect(credit("alice")).toBe(520);
    },
  );
  it("rejects a caller-supplied duration but preserves existing legacy day-based codes", async () => {
    await expect(
      code({ kind: "plan", planId: "creator", interval: "month", days: 365 }),
    ).rejects.toMatchObject({ status: 400 });
    const c = await code({ kind: "plan", planId: "creator" });
    db.prepare("UPDATE redeem_codes SET term_months=0,days=10 WHERE id=?").run(
      c.id,
    );
    const result = await redeem(request({ code: c.code }), "alice");
    expect(result.expires_at).toBe(now + 10 * 86400000);
  });
});
