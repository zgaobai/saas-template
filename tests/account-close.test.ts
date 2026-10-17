import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  session: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({ bindings: () => state.env }));
vi.mock("@/modules/auth/server/auth", () => ({
  auth: () => ({ api: { getSession: state.session } }),
}));
import { closeAccount } from "@/modules/account/server/close";
let db: DatabaseSync;
const now = new Date("2026-10-15T00:00:00Z");
function statement(sql: string, args: unknown[] = []): any {
  return {
    sql,
    args,
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...(args as any[])) ?? null,
  };
}
function request(
  data: unknown = { confirmation: "DELETE", email: "a@example.test" },
  origin = "https://example.test",
) {
  return new Request("https://example.test/api/app/account/close", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
function count(table: string, user = "a") {
  return db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`)
    .get(user)?.n;
}
function order(status = "paid") {
  db.prepare(
    "INSERT INTO orders (id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES ('o','a','creator','stripe',1900,'USD',500,?,0)",
  ).run(status);
}
function subscription(status: string) {
  order();
  db.prepare(
    "INSERT INTO subscriptions (id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at) VALUES ('s','a','o','provider-s','creator',?,0,0)",
  ).run(status);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("migrations/" + file, "utf8"));
  for (const id of ["a", "b"]) {
    db.prepare(
      "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,0,0)",
    ).run(id, id, id + "@example.test");
    db.prepare(
      "INSERT INTO session (id,expires_at,token,created_at,updated_at,user_id) VALUES (?,?,?,0,0,?)",
    ).run(id, now.getTime() + 60000, "token-" + id, id);
    db.prepare(
      "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,'credential',?,'hash',0,0)",
    ).run(id, id, id);
    db.prepare(
      "INSERT INTO generations (id,user_id,prompt,tone,status,cost,created_at) VALUES (?,?,'private prompt','natural','completed',1,0)",
    ).run(id, id);
    if (id === "b")
      db.prepare(
        "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES (?,?,'private.txt',?,12,'text/plain',0)",
      ).run(id, id, id + "/file");
    db.prepare("INSERT INTO wallets VALUES (?,0)").run(id);
    db.prepare(
      "INSERT INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,20,'welcome',0)",
    ).run(id, id);
    db.prepare(
      "INSERT INTO verification (id,identifier,value,expires_at,created_at,updated_at) VALUES (?,?,?,9999999999999,0,0)",
    ).run(id, "reset-" + id, id);
    db.prepare(
      "INSERT INTO verification (id,identifier,value,expires_at,created_at,updated_at) VALUES (?,?,?,9999999999999,0,0)",
    ).run(id + "-email", id + "@example.test", "value-" + id);
  }
  state.env = {
    APP_URL: "https://example.test",
    DB: {
      prepare: statement,
      batch: async (items: any[]) => {
        db.exec("BEGIN");
        try {
          for (const item of items) db.prepare(item.sql).run(...item.args);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
  state.session.mockReset().mockResolvedValue({
    user: { id: "a", email: "a@example.test" },
    session: { createdAt: now },
  });
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
});
it("atomically anonymizes owned data while retaining financial history and other users", async () => {
  subscription("CANCELED");
  db.exec(
    "INSERT INTO receipts (id,order_id,user_id,provider_id,amount,credits,created_at) VALUES ('r','o','a','payment',1900,500,0)",
  );
  await expect(closeAccount(request(), "a")).resolves.toEqual({ ok: true });
  const user = db.prepare("SELECT * FROM user WHERE id='a'").get();
  expect(user).toMatchObject({
    name: "已注销用户",
    email_verified: 0,
    image: null,
    closed_at: now.getTime(),
  });
  expect(user?.email).toMatch(/^closed-.*@deleted.invalid$/);
  for (const table of ["session", "account", "generations"]) {
    expect(count(table)).toBe(0);
    expect(count(table, "b")).toBe(1);
  }
  expect(db.prepare("SELECT COUNT(*) AS n FROM verification").get()?.n).toBe(2);
  expect(count("files")).toBe(0);
  expect(
    db.prepare("SELECT status FROM files WHERE id='b'").get()?.status,
  ).toBe("ready");
  for (const table of [
    "wallets",
    "credit_ledger",
    "orders",
    "subscriptions",
    "receipts",
  ])
    expect(count(table)).toBe(1);
  expect(
    db.prepare("SELECT action FROM audit_logs WHERE actor_id='a'").get()
      ?.action,
  ).toBe("account.closed");
});
it("does not remove any credentials or content when a pending order blocks closure", async () => {
  order("pending");
  await expect(closeAccount(request(), "a")).rejects.toMatchObject({
    status: 409,
  });
  expect(
    db.prepare("SELECT closed_at FROM user WHERE id='a'").get()?.closed_at,
  ).toBeNull();
  for (const table of ["session", "account", "generations"])
    expect(count(table)).toBe(1);
  expect(db.prepare("SELECT COUNT(*) AS n FROM verification").get()?.n).toBe(4);
  expect(count("files")).toBe(0);
});
it.each(["ACTIVE", "PAUSED", "CANCEL_AT_PERIOD_END", "UNKNOWN"])(
  "blocks subscription status %s",
  async (status) => {
    subscription(status);
    await expect(closeAccount(request(), "a")).rejects.toMatchObject({
      status: 409,
    });
    expect(count("session")).toBe(1);
  },
);
it.each([
  "CANCELED",
  "MERCHANT_CANCELLED",
  "USER_CANCELLED",
  "CHANNEL_CANCELLED",
  "CLOSE",
  "EXPIRED",
])("permits terminal subscription status %s", async (status) => {
  subscription(status);
  await expect(closeAccount(request(), "a")).resolves.toEqual({ ok: true });
});
it("rolls back anonymization and cleanup together when a deletion fails", async () => {
  db.exec(
    "CREATE TRIGGER fail_close BEFORE DELETE ON account BEGIN SELECT RAISE(ABORT,'simulated failure'); END",
  );
  await expect(closeAccount(request(), "a")).rejects.toThrow(
    "simulated failure",
  );
  expect(
    db.prepare("SELECT email,closed_at FROM user WHERE id='a'").get(),
  ).toMatchObject({ email: "a@example.test", closed_at: null });
  expect(count("session")).toBe(1);
});
it("requires the current owner and a recent authenticated session", async () => {
  await expect(closeAccount(request(), "b")).rejects.toMatchObject({
    status: 401,
  });
  state.session.mockResolvedValue({
    user: { id: "a", email: "a@example.test" },
    session: { createdAt: new Date(now.getTime() - 300001) },
  });
  await expect(closeAccount(request(), "a")).rejects.toMatchObject({
    status: 403,
  });
  expect(count("account")).toBe(1);
});
it.each([
  { confirmation: "delete", email: "a@example.test" },
  { confirmation: "DELETE", email: "b@example.test" },
  { confirmation: "DELETE", email: "a@example.test", extra: true },
])(
  "rejects invalid closure confirmation without modifying data",
  async (data) => {
    await expect(closeAccount(request(data), "a")).rejects.toMatchObject({
      status: 400,
    });
    expect(count("session")).toBe(1);
  },
);
it("rejects a cross-origin closure request", async () => {
  await expect(
    closeAccount(request(undefined, "https://attacker.test"), "a"),
  ).rejects.toMatchObject({ status: 403 });
  expect(count("account")).toBe(1);
});

it("blocks closure while a generation is pending, preserving its refund path", async () => {
  db.exec("UPDATE generations SET status='pending' WHERE id='a'");
  await expect(closeAccount(request(), "a")).rejects.toMatchObject({
    status: 409,
  });
  expect(
    db.prepare("SELECT closed_at FROM user WHERE id='a'").get()?.closed_at,
  ).toBeNull();
  expect(
    db.prepare("SELECT status FROM generations WHERE id='a'").get()?.status,
  ).toBe("pending");
  expect(count("session")).toBe(1);
  db.exec("UPDATE generations SET status='failed' WHERE id='a'");
  await expect(closeAccount(request(), "a")).resolves.toEqual({ ok: true });
});

it.each(["paid", "refunded"])(
  "blocks a %s subscription order without authoritative subscription state",
  async (status) => {
    order(status);
    await expect(closeAccount(request(), "a")).rejects.toMatchObject({
      status: 409,
    });
    expect(count("account")).toBe(1);
  },
);
it.each(["failed", "expired"])(
  "permits a %s subscription order without a subscription",
  async (status) => {
    order(status);
    await expect(closeAccount(request(), "a")).resolves.toEqual({ ok: true });
  },
);
it("permits a paid one-off order while preserving its billing records", async () => {
  order("paid");
  db.exec("UPDATE orders SET plan_id='pack' WHERE id='o'");
  await expect(closeAccount(request(), "a")).resolves.toEqual({ ok: true });
  expect(count("orders")).toBe(1);
});

it("blocks new sessions, credentials, orders, generations and files after closure", async () => {
  await closeAccount(request(), "a");
  const inserts = [
    "INSERT INTO session (id,expires_at,token,created_at,updated_at,user_id) VALUES ('new',9999999999999,'new-token',0,0,'a')",
    "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('new','new','credential','a','hash',0,0)",
    "INSERT INTO orders (id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES ('new','a','pack','stripe',900,'USD',200,'pending',0)",
    "INSERT INTO generations (id,user_id,prompt,tone,status,cost,created_at) VALUES ('new','a','hello','natural','pending',1,0)",
    "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES ('new','a','new.txt','a/new',12,'text/plain',0)",
  ];
  for (const sql of inserts) expect(() => db.exec(sql)).toThrow(/closed/i);
});

it("prevents closed accounts from reactivating subscriptions while permitting terminal bookkeeping", async () => {
  subscription("CANCELED");
  await closeAccount(request(), "a");
  expect(() =>
    db.exec("UPDATE subscriptions SET status='ACTIVE' WHERE id='s'"),
  ).toThrow(/closed/i);
  expect(() =>
    db.exec(
      "INSERT INTO subscriptions (id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at) VALUES ('new','a','o','provider-new','creator','ACTIVE',0,0)",
    ),
  ).toThrow(/closed/i);
  expect(() =>
    db.exec(
      "UPDATE subscriptions SET status='EXPIRED',updated_at=1 WHERE id='s'",
    ),
  ).not.toThrow();
  expect(() =>
    db.exec(
      "INSERT INTO subscriptions (id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at) VALUES ('terminal','a','o','provider-terminal','creator','CANCELED',0,0)",
    ),
  ).not.toThrow();
});

it("requires manual file deletion before closing and leaves the account usable", async () => {
  db.exec(
    "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES ('file','a','private.txt','a/file',12,'text/plain',0)",
  );
  await expect(closeAccount(request(), "a")).rejects.toMatchObject({
    status: 409,
  });
  expect(count("session")).toBe(1);
  expect(count("files")).toBe(1);
  db.exec("DELETE FROM files WHERE user_id='a'");
  await expect(closeAccount(request(), "a")).resolves.toEqual({ ok: true });
});
