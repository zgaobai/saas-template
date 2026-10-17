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
import {
  adminUserDetail,
  adminUserRecords,
  listAdminUsers,
  listAdminOrders,
  listAdminSubscriptions,
  listAdminAudit,
} from "@/modules/admin/server/queries";
import { endpoint } from "@/server/http";
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
describe("admin list authorization and boundaries", () => {
  it.each([
    listAdminUsers,
    listAdminOrders,
    listAdminSubscriptions,
    listAdminAudit,
  ])("blocks guests and members before reading data", async (list) => {
    state.userId = null;
    await expect(list(request())).rejects.toMatchObject({ status: 401 });
    state.userId = "member";
    await expect(list(request())).rejects.toMatchObject({ status: 403 });
    expect(state.sql).toHaveLength(0);
  });
  it("rejects invalid filters and malformed cursors", async () => {
    for (const query of [
      "status=bogus",
      "provider=bogus",
      "cursor=nope",
      "cursor=" +
        encodeURIComponent(
          Buffer.from('{"time":-1,"id":"x"}').toString("base64url"),
        ),
      "search=" + "x".repeat(257),
      "limit=100000",
    ])
      await expect(listAdminOrders(request(query))).rejects.toMatchObject({
        status: 400,
      });
    expect(state.sql).toHaveLength(0);
  });
  it("returns no checkout URL or secret fields, and uses no-store responses", async () => {
    addOrder("o");
    const response = await endpoint(() => listAdminOrders(request()));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const data = (await response.json()) as any;
    expect(data.items[0]).toMatchObject({
      id: "o",
      amount: 900,
      currency: "USD",
      provider: "pancake",
    });
    expect(data.items[0]).not.toHaveProperty("checkout_url");
    expect(JSON.stringify(data)).not.toContain("secret-checkout");
  });
});
describe("real SQLite queries and pagination", () => {
  it("keeps timestamp ties across order pages without duplication or loss", async () => {
    for (let i = 0; i < 28; i++) addOrder("o" + String(i).padStart(2, "0"));
    const first = await listAdminOrders(request());
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).toBeTruthy();
    const second = await listAdminOrders(request("cursor=" + first.nextCursor));
    expect(second.items).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((o) => o.id)).size,
    ).toBe(28);
  });
  it("combines exact user/order search, status and original provider without mutation", async () => {
    addOrder("paid", "member", "stripe", "paid");
    addOrder("other", "admin", "pancake", "pending");
    for (const search of [
      "member@example.test",
      "member",
      "paid",
      "provider-paid",
    ]) {
      const result = await listAdminOrders(
        request(
          new URLSearchParams({
            search,
            status: "paid",
            provider: "stripe",
          }).toString(),
        ),
      );
      expect(result.items.map((o) => o.id)).toEqual(["paid"]);
    }
    expect(
      (
        await listAdminOrders(
          request("search=" + encodeURIComponent("' OR 1=1--")),
        )
      ).items,
    ).toEqual([]);
    expect(
      (await listAdminOrders(request("provider=pancake&status=paid"))).items,
    ).toEqual([]);
    expect(
      db.prepare("SELECT status FROM orders WHERE id='other'").get()?.status,
    ).toBe("pending");
  });
  it("queries subscriptions by owner and original channel and separates status from paid entitlement", async () => {
    addOrder("o", "member", "creem");
    addSubscription("s", "o", "CANCELED");
    const result = await listAdminSubscriptions(
      request("search=member%40example.test&status=CANCELED&provider=creem"),
    );
    expect(result.items[0]).toMatchObject({
      id: "s",
      provider: "creem",
      paid_until: 123456,
      status: "CANCELED",
      order_id: "o",
    });
    expect(
      (await listAdminSubscriptions(request("provider=stripe"))).items,
    ).toEqual([]);
    for (const search of ["s", "provider-s", "o"])
      expect(
        (await listAdminSubscriptions(request("search=" + search))).items,
      ).toHaveLength(1);
  });
  it("paginates users, subscriptions and audit events and resolves actor and target", async () => {
    for (let i = 0; i < 27; i++) {
      const id = String(i).padStart(2, "0");
      addUser("u" + id);
      addOrder("o" + id);
      addSubscription("s" + id, "o" + id);
      db.prepare(
        "INSERT INTO audit_logs VALUES (?,'admin','credit_grant:20:测试原因','member',100)",
      ).run("a" + id);
    }
    for (const list of [
      listAdminUsers,
      listAdminSubscriptions,
      listAdminAudit,
    ]) {
      const first = await list(request());
      const second = await list(request("cursor=" + first.nextCursor));
      expect(first.items).toHaveLength(25);
      expect(second.items.length).toBeGreaterThan(0);
      expect(second.nextCursor).toBeNull();
      expect(
        new Set([...first.items, ...second.items].map((i) => i.id)).size,
      ).toBe(first.items.length + second.items.length);
    }
    const audit = await listAdminAudit(
      request("search=member%40example.test&status=credit_grant"),
    );
    expect(audit.items[0]).toMatchObject({
      actor_name: "admin",
      target_name: "member",
      action: "credit_grant:20:测试原因",
    });
    expect(
      (await listAdminAudit(request("status=account.closed"))).items,
    ).toEqual([]);
    db.exec("UPDATE user SET closed_at=100 WHERE id='member'");
    expect(
      (await listAdminUsers(request("status=closed"))).items.map((u) => u.id),
    ).toEqual(["member"]);
  });
  it("uses migration indexes for default, status-filtered and cursor list ordering", async () => {
    await listAdminUsers(request());
    await listAdminOrders(request());
    await listAdminOrders(request("status=pending"));
    await listAdminSubscriptions(request());
    await listAdminSubscriptions(request("status=ACTIVE"));
    await listAdminAudit(request());
    await listAdminOrders(
      request(
        "cursor=" +
          Buffer.from(JSON.stringify({ time: 100, id: "o" })).toString(
            "base64url",
          ),
      ),
    );
    for (const query of state.sql) {
      const plan = db
        .prepare("EXPLAIN QUERY PLAN " + query.sql)
        .all(...query.args)
        .map((r) => r.detail)
        .join("\n");
      expect(plan).toContain("admin_");
      expect(plan).not.toContain("TEMP B-TREE");
    }
  });
});

describe("user details and scoped records", () => {
  it("reports original signup method, linked login methods and verification without secrets", async () => {
    db.prepare(
      "INSERT INTO account(id,account_id,provider_id,user_id,password,access_token,created_at,updated_at) VALUES ('a','member','credential','member','private-password',NULL,1,1),('b','google-id','google','member',NULL,'private-token',2,2)",
    ).run();
    const detail = await adminUserDetail(request(), "member");
    expect(detail.user).toMatchObject({
      registration_provider: "credential",
      has_google: 1,
      has_password: 1,
      email_verified: 1,
    });
    expect(JSON.stringify(detail)).not.toContain("private-");
    db.prepare("UPDATE account SET created_at=0 WHERE id='b'").run();
    expect(
      (await listAdminUsers(request("search=member"))).items[0]
        .registration_provider,
    ).toBe("google");
    db.prepare("UPDATE user SET email_verified=0 WHERE id='member'").run();
    expect(
      (await adminUserDetail(request(), "member")).user.email_verified,
    ).toBe(0);
  });
  it("enforces user scope on each records page with stable pagination", async () => {
    for (let i = 0; i < 27; i++) addOrder("member-order-" + i);
    addOrder("admin-order", "admin");
    const first = await adminUserRecords(request(), "member", "orders");
    const second = await adminUserRecords(
      request("cursor=" + first.nextCursor),
      "member",
      "orders",
    );
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(2);
    expect(
      [...first.items, ...second.items].some((x) => x.id === "admin-order"),
    ).toBe(false);
    expect(
      new Set([...first.items, ...second.items].map((x) => x.id)).size,
    ).toBe(27);
    for (const kind of ["tasks", "ledger", "subscriptions", "redemptions"])
      expect((await adminUserRecords(request(), "member", kind)).items).toEqual(
        [],
      );
  });
  it("lists only the target user's subscriptions with paid expiry and stable indexed pagination", async () => {
    const future = Date.now() + 86400000;
    for (let i = 0; i < 27; i++) {
      const id = String(i).padStart(2, "0");
      addOrder("order-" + id, "member", "pancake");
      addSubscription("sub-" + id, "order-" + id, "CANCELED", 200);
    }
    db.prepare("UPDATE orders SET plan_name='创作者'").run();
    db.prepare("UPDATE subscriptions SET paid_until=?").run(future);
    addOrder("other-order", "admin", "stripe");
    addSubscription("other-sub", "other-order");
    db.prepare(
      "UPDATE subscriptions SET user_id='admin' WHERE id='other-sub'",
    ).run();
    const first = await adminUserRecords(request(), "member", "subscriptions");
    const second = await adminUserRecords(
      request("cursor=" + first.nextCursor),
      "member",
      "subscriptions",
    );
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    const all = [...first.items, ...second.items];
    expect(new Set(all.map((row) => row.id)).size).toBe(27);
    expect(all.every((row) => row.id.startsWith("sub-"))).toBe(true);
    expect(first.items[0]).toMatchObject({
      id: "sub-26",
      order_id: "order-26",
      status: "CANCELED",
      paid_until: future,
      updated_at: 200,
      provider: "pancake",
      plan_name: "创作者",
    });
    expect(JSON.stringify(all)).not.toContain("secret-checkout");
    for (const query of state.sql) {
      const plan = db
        .prepare("EXPLAIN QUERY PLAN " + query.sql)
        .all(...query.args)
        .map((r) => r.detail)
        .join("\n");
      expect(plan).toContain("subscription_user_updated_idx");
      expect(plan).not.toContain("TEMP B-TREE");
    }
    for (const user of [null, "member"]) {
      state.userId = user;
      await expect(
        adminUserRecords(request(), "admin", "subscriptions"),
      ).rejects.toMatchObject({ status: user ? 403 : 401 });
    }
  });
  it("rejects non-admin reads and missing users or invalid record types", async () => {
    for (const user of [null, "member"]) {
      state.userId = user;
      await expect(adminUserDetail(request(), "admin")).rejects.toMatchObject({
        status: user ? 403 : 401,
      });
      await expect(
        adminUserRecords(request(), "admin", "orders"),
      ).rejects.toMatchObject({ status: user ? 403 : 401 });
    }
    state.userId = "admin";
    await expect(adminUserDetail(request(), "missing")).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      adminUserRecords(request(), "missing", "ledger"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      adminUserRecords(request(), "member", "credentials"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      adminUserRecords(request("search=admin"), "member", "orders"),
    ).rejects.toMatchObject({ status: 400 });
  });
});
