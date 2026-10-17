import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => state.env,
  publicCapabilities: () => ({ ai: false }),
}));
import { limitRequest } from "@/server/rate-limit";
import { endpoint } from "@/server/http";
import { listHistory, deleteHistory } from "@/modules/history/server/service";
import { recoverStale } from "@/modules/tools/server/generation";
import { runMaintenance, runScheduledMaintenance } from "@/server/maintenance";
let db: DatabaseSync;
function statement(sql: string, args: unknown[] = []): any {
  return {
    sql,
    args,
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...(args as any[])) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(args as any[])) }),
    run: async () => ({
      meta: { changes: db.prepare(sql).run(...(args as any[])).changes },
    }),
  };
}
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const f of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("migrations/" + f, "utf8"));
  for (const id of ["a", "b"]) {
    db.prepare(
      "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,0,0)",
    ).run(id, id, id + "@example.test");
    db.prepare("INSERT INTO wallets VALUES (?,0)").run(id);
  }
  state.env = {
    DB: {
      prepare: statement,
      batch: async (items: any[]) => {
        db.exec("BEGIN");
        try {
          for (const s of items) db.prepare(s.sql).run(...s.args);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
  };
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});
function generation(id: string, user = "a", status = "completed", at = 10) {
  db.prepare(
    "INSERT INTO generations (id,user_id,prompt,tone,tool_id,output,status,cost,created_at) VALUES (?,?,'hello','natural','copywriting','result',?,1,?)",
  ).run(id, user, status, at);
}
it("atomically caps concurrent calls and isolates users", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      limitRequest("a", "upload", 3, 60000, 100),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  await expect(
    limitRequest("b", "upload", 3, 60000, 100),
  ).resolves.toBeUndefined();
  await expect(
    limitRequest("a", "upload", 3, 60000, 60001),
  ).resolves.toBeUndefined();
});
it("rate-limit responses include retry and correlation IDs, never raw exceptions", async () => {
  await limitRequest("a", "x", 1, 60000, 100);
  const r = await endpoint(() => limitRequest("a", "x", 1, 60000, 101));
  expect(r.status).toBe(429);
  expect(r.headers.get("Retry-After")).toBe("60");
  const body = (await r.json()) as { requestId: string };
  expect(body.requestId).toBe(r.headers.get("X-Request-ID"));
});
it("history pagination keeps timestamp ties, scopes ownership and limits page size", async () => {
  for (let i = 0; i < 26; i++) generation("g" + String(i).padStart(2, "0"));
  generation("private", "b");
  const first = await listHistory(
    new Request("https://example.test/history"),
    "a",
  );
  expect(first.history).toHaveLength(20);
  const second = await listHistory(
    new Request("https://example.test/history?cursor=" + first.nextCursor),
    "a",
  );
  expect(second.history).toHaveLength(6);
  expect(
    new Set([...first.history, ...second.history].map((x) => x.id)).size,
  ).toBe(26);
  expect(second.nextCursor).toBeNull();
});
it("history search escapes wildcard input and rejects malformed cursors", async () => {
  generation("g");
  const result = await listHistory(
    new Request("https://example.test/history?search=%25"),
    "a",
  );
  expect(result.history).toHaveLength(0);
  await expect(
    listHistory(
      new Request("https://example.test/history?cursor=invalid"),
      "a",
    ),
  ).rejects.toThrow("分页");
});
it("history removal rejects other owners and running tasks", async () => {
  generation("pending", "a", "pending");
  generation("other", "b");
  generation("done");
  await expect(deleteHistory("other", "a")).rejects.toThrow("不存在");
  await expect(deleteHistory("pending", "a")).rejects.toThrow("生成中");
  await deleteHistory("done", "a");
  expect(
    db.prepare("SELECT id FROM generations WHERE id='done'").get(),
  ).toBeUndefined();
});
it("recovers abandoned AI tasks without requiring a user visit and refunds once", async () => {
  generation("stale", "a", "pending", 0);
  generation("fresh", "b", "pending", Date.now());
  await recoverStale(undefined, 100);
  await recoverStale(undefined, 100);
  expect(
    db.prepare("SELECT balance FROM wallets WHERE user_id='a'").get()?.balance,
  ).toBe(1);
  expect(
    db.prepare("SELECT status FROM generations WHERE id='stale'").get()?.status,
  ).toBe("failed");
  expect(
    db.prepare("SELECT status FROM generations WHERE id='fresh'").get()?.status,
  ).toBe("pending");
});
it("scheduled maintenance cleans only expired sessions and records completion", async () => {
  db.exec(
    "INSERT INTO session VALUES ('old',0,'old-token',0,0,NULL,NULL,'a'); INSERT INTO session VALUES ('live',9999999999999,'live-token',0,0,NULL,NULL,'b')",
  );
  await expect(runMaintenance()).resolves.toMatchObject({
    status: "completed",
  });
  expect(db.prepare("SELECT id FROM session").all()).toEqual([{ id: "live" }]);
  expect(
    db.prepare("SELECT status,lease_until FROM maintenance_state").get(),
  ).toMatchObject({ status: "completed", lease_until: 0 });
});
it("active maintenance lease avoids duplicate work, failed database cleanup is visible", async () => {
  db.prepare(
    "INSERT INTO maintenance_state(id,lease_until) VALUES ('routine',?)",
  ).run(Date.now() + 60000);
  await expect(runMaintenance()).resolves.toEqual({ skipped: true });
  db.exec("UPDATE maintenance_state SET lease_until=0");
  (state.env.DB as { batch: unknown }).batch = async () => {
    throw new Error("database unavailable");
  };
  await expect(runMaintenance()).rejects.toThrow("incomplete");
  expect(
    db.prepare("SELECT status,lease_until FROM maintenance_state").get(),
  ).toMatchObject({ status: "failed", lease_until: 0 });
});

it("maintenance grants due annual redemption installments without visits, recovers failures and never repeats", async () => {
  const start = Date.UTC(2026, 0, 16, 2);
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  db.prepare(
    "INSERT INTO redeem_codes(id,code_hash,hint,name,kind,plan_id,plan_name,credits,grant_months,term_months,max_uses,expires_at,created_at) VALUES ('scheduled-code','hash','ABCDEF','定时验收','plan','creator','创作者',500,12,12,1,?,?)",
  ).run(start + 86400000, start);
  db.prepare(
    "INSERT INTO redemptions(id,code_id,user_id,credits,plan_id,plan_name,expires_at,created_at,grant_months,starts_at) VALUES ('scheduled-redemption','scheduled-code','a',500,'creator','创作者',0,?,12,?)",
  ).run(start, start);
  const balance = () =>
    db.prepare("SELECT balance FROM wallets WHERE user_id='a'").get()!.balance;
  expect(balance()).toBe(500);
  await runScheduledMaintenance("0 0 * * *");
  expect(balance()).toBe(500);
  clock.mockReturnValue(Date.UTC(2026, 1, 17, 0));
  // Five-minute routine maintenance must never grant daily credits.
  await runScheduledMaintenance("*/5 * * * *");
  expect(balance()).toBe(500);
  // A routine task lease cannot block the independent credit job.
  db.prepare(
    "UPDATE maintenance_state SET lease_until=? WHERE id='routine'",
  ).run(Date.now() + 60000);
  db.exec(
    "CREATE TRIGGER fail_grant BEFORE INSERT ON credit_ledger WHEN NEW.id LIKE 'redeem-month:%' BEGIN SELECT RAISE(ABORT,'temporary failure'); END;",
  );
  await expect(runScheduledMaintenance("0 0 * * *")).rejects.toThrow(
    "incomplete",
  );
  expect(balance()).toBe(500);
  expect(
    db
      .prepare(
        "SELECT granted_at FROM redemption_installments WHERE installment=2",
      )
      .get()!.granted_at,
  ).toBeNull();
  db.exec("DROP TRIGGER fail_grant");
  await runScheduledMaintenance("0 0 * * *");
  await runScheduledMaintenance("0 0 * * *");
  expect(balance()).toBe(1000);
  expect(
    db
      .prepare(
        "SELECT COUNT(*) n FROM credit_ledger WHERE id LIKE 'redeem-month:%'",
      )
      .get()!.n,
  ).toBe(2);
  expect(
    db
      .prepare(
        "SELECT status,lease_until FROM maintenance_state WHERE id='credits'",
      )
      .get(),
  ).toMatchObject({ status: "completed", lease_until: 0 });
});

it("history status filters keep refunds and results scoped to the owner", async () => {
  generation("done");
  generation("failed", "a", "failed");
  generation("blocked", "a", "blocked");
  generation("running", "a", "pending");
  generation("other-failed", "b", "failed");
  db.prepare(
    "INSERT INTO credit_ledger(id,user_id,amount,reason,created_at) VALUES ('release:failed','a',1,'任务失败退回',20)",
  ).run();
  const result = await listHistory(
    new Request("https://example.test/history?status=failed"),
    "a",
  );
  expect(result.history.map((g) => g.id)).toEqual(["failed"]);
  expect(result.history[0].refunded).toBe(1);
  const completed = await listHistory(
    new Request("https://example.test/history?status=completed"),
    "a",
  );
  expect(completed.history[0].output).toBe("result");
  expect(completed.history[0].refunded).toBe(0);
});
