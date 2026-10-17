import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  userId: "admin" as string | null,
  sql: [] as { sql: string; args: any[] }[],
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
import { personalBillingRecords } from "@/modules/account/server/billing-records";
let db: DatabaseSync;
function statement(sql: string, args: any[] = []): any {
  return {
    bind: (...values: any[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => {
      state.sql.push({ sql, args });
      return { results: db.prepare(sql).all(...args) };
    },
  };
}
const request = (query = "") =>
  new Request("https://app.test/api/app/admin/list?" + query);
function addUser(id: string, time = 100) {
  db.prepare(
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)",
  ).run(id, id, id + "@example.test", time, time);
}
function addOrder(
  id: string,
  user = "member",
  provider = "pancake",
  status = "pending",
  time = 100,
) {
  db.prepare(
    "INSERT INTO orders(id,user_id,plan_id,provider,provider_id,amount,currency,credits,status,created_at,checkout_url) VALUES (?,?,'pack',?,?,900,'USD',200,?,?,?)",
  ).run(
    id,
    user,
    provider,
    "provider-" + id,
    status,
    time,
    "https://secret-checkout.test/token",
  );
}
function addSubscription(
  id: string,
  order: string,
  status = "ACTIVE",
  time = 200,
) {
  db.prepare(
    "INSERT INTO subscriptions(id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at) VALUES (?,'member',?,?,'creator',?,123456,?)",
  ).run(id, order, "provider-" + id, status, time);
}
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("migrations/" + file, "utf8"));
  addUser("admin");
  addUser("member");
  state.userId = "admin";
  state.sql = [];
  state.env = { ADMIN_USER_IDS: " admin ", DB: { prepare: statement } };
});
afterEach(() => db.close());

function records(section: string, cursor = "", user = "member") {
  return personalBillingRecords(
    new Request(
      "https://app.test/api/app/billing/records?" +
        new URLSearchParams({ section, cursor }),
    ),
    user,
  );
}
function addRedemption(id: string, user = "member") {
  db.prepare(
    "INSERT INTO wallets(user_id,balance) VALUES (?,0) ON CONFLICT DO NOTHING",
  ).run(user);
  db.prepare(
    "INSERT INTO redeem_codes(id,code_hash,hint,name,kind,credits,max_uses,expires_at,created_at) VALUES (?,?,?,'test','credits',1,1,9999999999999,1)",
  ).run(id, id, id);
  db.prepare(
    "INSERT INTO redemptions(id,code_id,user_id,credits,created_at) VALUES (?,?,?,1,100)",
  ).run(id, id, user);
}
describe("personal billing records", () => {
  it.each(["orders", "subscriptions", "redemptions"] as const)(
    "paginates all %s beyond 50 with timestamp ties and owner isolation",
    async (section) => {
      for (let i = 0; i < 56; i++) {
        const id = String(i).padStart(3, "0");
        if (section === "redemptions") addRedemption(id);
        else {
          addOrder(id);
          if (section === "subscriptions") addSubscription(id, id);
        }
      }
      if (section === "redemptions") addRedemption("private", "admin");
      else {
        addOrder("private", "admin");
        if (section === "subscriptions")
          db.prepare(
            "INSERT INTO subscriptions(id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at) VALUES ('private','admin','private','private','creator','ACTIVE',999,200)",
          ).run();
      }
      const first = await records(section);
      const second = await records(section, first.nextCursor!);
      const third = await records(section, second.nextCursor!);
      expect(first[section]).toHaveLength(25);
      expect(second[section]).toHaveLength(25);
      expect(third[section]).toHaveLength(6);
      expect(third.nextCursor).toBeNull();
      expect(
        new Set(
          [...first[section], ...second[section], ...third[section]].map(
            (x) => x.id,
          ),
        ).size,
      ).toBe(56);
      expect(
        [...first[section], ...second[section], ...third[section]].some(
          (x) => x.id === "private",
        ),
      ).toBe(false);
      for (const q of state.sql) {
        const plan = db
          .prepare("EXPLAIN QUERY PLAN " + q.sql)
          .all(...q.args)
          .map((x) => String(x.detail))
          .join(" ");
        expect(plan).toMatch(
          /USING INDEX (orders_user_page_idx|subscription_user_updated_idx|redemption_user_page_idx)/,
        );
        expect(plan).not.toContain("TEMP B-TREE");
      }
    },
  );
  it("rejects malformed and cross-section cursors and arbitrary owner input", async () => {
    await expect(records("orders", "invalid")).rejects.toThrow("分页");
    const cursor = Buffer.from(
      JSON.stringify({ section: "subscriptions", time: 100, id: "a" }),
    ).toString("base64url");
    await expect(records("orders", cursor)).rejects.toThrow("分页");
    await expect(records("unknown")).rejects.toThrow("查询");
    await expect(
      personalBillingRecords(
        new Request("https://app.test/?section=orders&user_id=admin"),
        "member",
      ),
    ).rejects.toThrow("查询");
  });
  it("returns an empty final page and rejects subscriptions joined to another owner's order", async () => {
    expect((await records("orders")).nextCursor).toBeNull();
    addOrder("foreign", "admin");
    addSubscription("bad", "foreign");
    expect((await records("subscriptions")).subscriptions).toEqual([]);
  });
});
