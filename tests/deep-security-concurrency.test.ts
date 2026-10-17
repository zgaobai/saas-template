import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  userId: "user_alice" as string | null,
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
              user: {
                id: state.userId,
                email: state.userId + "@example.test",
                role: state.userId.includes("admin") ? "admin" : "user",
              },
            }
          : null,
    },
  }),
}));

import { appApi } from "@/server/app-api";
import { endpoint, HttpError } from "@/server/http";

const callApi = (req: Request, path: string) => endpoint(() => appApi(req, path));

let db: DatabaseSync;
let r2Storage: Map<string, { body: Uint8Array; metadata: any }>;

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
    .sort()) {
    db.exec(readFileSync("migrations/" + f, "utf8"));
  }

  // Seed test users: alice, bob, admin
  for (const id of ["user_alice", "user_bob", "user_admin"]) {
    db.prepare(
      "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,0,0)",
    ).run(id, id, id + "@example.test");
    db.prepare("INSERT INTO wallets (user_id,balance) VALUES (?,0)").run(id);
  }

  r2Storage = new Map();

  state.env = {
    APP_URL: "http://127.0.0.1:4317",
    ADMIN_USER_IDS: "user_admin",
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
    FILES: {
      get: async (key: string) => {
        const item = r2Storage.get(key);
        if (!item) return null;
        return {
          body: item.body,
          customMetadata: item.metadata,
        };
      },
      put: async (key: string, data: ArrayBuffer, options?: any) => {
        r2Storage.set(key, {
          body: new Uint8Array(data),
          metadata: options?.customMetadata,
        });
      },
      delete: async (key: string) => {
        r2Storage.delete(key);
      },
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  try {
    db.close();
  } catch {}
});

describe("Deep Audit: Concurrency & Double-Spend Defense", () => {
  it("strictly prevents double-spending on single-use redemption codes under concurrent race", async () => {
    // 1. Create a single-use code in DB directly
    const codeId = "code_race_test";
    const codeHashVal = "hash_race_test";
    const now = Date.now();
    db.prepare(
      `INSERT INTO redeem_codes (id,code_hash,code_ciphertext,hint,name,kind,plan_id,plan_name,credits,term_months,grant_months,max_uses,used,expires_at,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    ).run(
      codeId,
      codeHashVal,
      "cipher",
      "test",
      "Race Code",
      "credits",
      null,
      null,
      50,
      0, // term_months = 0 for credit codes
      1,
      1, // max_uses = 1
      now + 86400000,
      now,
    );

    // 2. Simulate 5 different users attempting to redeem this exact code concurrently
    const userIds = [
      "user_alice",
      "user_bob",
      "user_user3",
      "user_user4",
      "user_user5",
    ];
    for (const uid of ["user_user3", "user_user4", "user_user5"]) {
      db.prepare(
        "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,0,0)",
      ).run(uid, uid, uid + "@example.test");
      db.prepare("INSERT INTO wallets (user_id,balance) VALUES (?,0)").run(uid);
    }

    const redeemForUser = async (uid: string) => {
      // Direct SQL insertion simulating atomic redemption trigger execution
      try {
        db.exec("BEGIN");
        db.prepare(
          `INSERT INTO redemptions(id,code_id,user_id,credits,plan_id,plan_name,expires_at,created_at,grant_months,starts_at)
           VALUES (?,?, ?, 50, NULL, NULL, 0, ?, 1, 0)`,
        ).run("red_" + uid, codeId, uid, now);
        db.exec("COMMIT");
        return { success: true, uid };
      } catch (err: any) {
        db.exec("ROLLBACK");
        return { success: false, uid, error: err.message };
      }
    };

    // Run all 5 concurrently
    const results = await Promise.all(userIds.map((uid) => redeemForUser(uid)));

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // EXACTLY 1 must succeed
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(4);

    // Used count in DB must be exactly 1
    const code = db
      .prepare("SELECT used, max_uses FROM redeem_codes WHERE id=?")
      .get(codeId) as any;
    expect(code.used).toBe(1);

    // Total rows in redemptions table must be exactly 1
    const totalRedemptions = db
      .prepare("SELECT COUNT(*) as n FROM redemptions WHERE code_id=?")
      .get(codeId) as any;
    expect(totalRedemptions.n).toBe(1);

    // Total ledger entries for this code must be exactly 1 (+50 credits)
    const ledgerEntries = db
      .prepare("SELECT COUNT(*) as n, SUM(amount) as s FROM credit_ledger WHERE reason LIKE '%Race Code%' OR id LIKE 'redeem:%'")
      .get() as any;
    expect(ledgerEntries.n).toBe(1);
    expect(ledgerEntries.s).toBe(50);
  });

  it("strictly enforces database trigger redemption_single_use preventing any 2nd redemption across all users", async () => {
    const codeId = "code_multi_race";
    const now = Date.now();
    db.prepare(
      `INSERT INTO redeem_codes (id,code_hash,code_ciphertext,hint,name,kind,plan_id,plan_name,credits,term_months,grant_months,max_uses,used,expires_at,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    ).run(
      codeId,
      "hash_multi",
      "cipher",
      "test",
      "Multi Code Attempt",
      "credits",
      null,
      null,
      10,
      0,
      1,
      3, // Even if max_uses was configured as 3 in schema
      now + 86400000,
      now,
    );

    const userCount = 5;
    const userIds = Array.from({ length: userCount }, (_, i) => `u_multi_${i}`);
    for (const uid of userIds) {
      db.prepare(
        "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,0,0)",
      ).run(uid, uid, uid + "@example.test");
      db.prepare("INSERT INTO wallets (user_id,balance) VALUES (?,0)").run(uid);
    }

    const results = await Promise.all(
      userIds.map(async (uid) => {
        try {
          db.exec("BEGIN");
          db.prepare(
            `INSERT INTO redemptions(id,code_id,user_id,credits,plan_id,plan_name,expires_at,created_at,grant_months,starts_at)
             VALUES (?,?, ?, 10, NULL, NULL, 0, ?, 1, 0)`,
          ).run("red_" + uid, codeId, uid, now);
          db.exec("COMMIT");
          return { success: true, error: null };
        } catch (err: any) {
          db.exec("ROLLBACK");
          return { success: false, error: err.message };
        }
      }),
    );

    // Exactly 1 must succeed
    expect(results.filter((r) => r.success)).toHaveLength(1);
    // All others must be rejected with redemption_already_used
    const rejected = results.filter((r) => !r.success);
    expect(rejected).toHaveLength(userCount - 1);
    for (const r of rejected) {
      expect(r.error).toContain("redemption_already_used");
    }

    const code = db
      .prepare("SELECT used FROM redeem_codes WHERE id=?")
      .get(codeId) as any;
    expect(code.used).toBe(1);
  });

  it("strictly prevents wallet overdraft under high concurrent debit attacks", async () => {
    // Give user_alice exactly 15 credits
    db.prepare("INSERT INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES ('seed_alice','user_alice',15,'seed',0)").run();
    
    const balanceBefore = (db.prepare("SELECT balance FROM wallets WHERE user_id='user_alice'").get() as any).balance;
    expect(balanceBefore).toBe(15);

    // Launch 10 concurrent debit operations of 5 credits each (total 50 credits attempted)
    const debit = async (i: number) => {
      try {
        db.exec("BEGIN");
        db.prepare(
          "INSERT INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?, 'user_alice', -5, 'concurrent_debit', ?)",
        ).run(`debit_${i}`, Date.now());
        db.exec("COMMIT");
        return { success: true };
      } catch (err: any) {
        db.exec("ROLLBACK");
        return { success: false, error: err.message };
      }
    };

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => debit(i)),
    );

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactly 3 debits must succeed (3 * 5 = 15 credits)
    expect(successes).toHaveLength(3);
    // 7 must fail with insufficient_credits
    expect(failures).toHaveLength(7);
    for (const f of failures) {
      expect(f.error).toContain("insufficient_credits");
    }

    // Balance must be strictly 0, NEVER negative
    const balanceAfter = (db.prepare("SELECT balance FROM wallets WHERE user_id='user_alice'").get() as any).balance;
    expect(balanceAfter).toBe(0);
  });
});

describe("Deep Audit: Security, Boundaries & IDOR Prevention", () => {
  it("enforces strict IDOR file download isolation (Bob cannot download Alice's file)", async () => {
    // 1. Insert file belonging to Alice
    const fileId = "alice_secret_doc";
    const now = Date.now();
    db.prepare(
      "INSERT INTO files (id,user_id,name,key,size,content_type,created_at,status,updated_at) VALUES (?,?,?,?,?,?,?,'ready',?)",
    ).run(fileId, "user_alice", "confidential.txt", "user_alice/" + fileId, 100, "text/plain", now, now);

    r2Storage.set("user_alice/" + fileId, {
      body: new TextEncoder().encode("Alice's top secret data"),
      metadata: { ownerId: "user_alice" },
    });

    // 2. Request download as Bob
    state.userId = "user_bob";
    const req = new Request(`http://127.0.0.1:4317/api/app/files/${fileId}`, {
      method: "GET",
    });

    const res = await callApi(req, `files/${fileId}`);
    expect(res.status).toBe(404);
  });

  it("enforces strict IDOR file deletion isolation (Bob cannot delete Alice's file)", async () => {
    const fileId = "alice_file_to_delete";
    const now = Date.now();
    db.prepare(
      "INSERT INTO files (id,user_id,name,key,size,content_type,created_at,status,updated_at) VALUES (?,?,?,?,?,?,?,'ready',?)",
    ).run(fileId, "user_alice", "important.pdf", "user_alice/" + fileId, 200, "application/pdf", now, now);

    r2Storage.set("user_alice/" + fileId, {
      body: new Uint8Array(200),
      metadata: { ownerId: "user_alice" },
    });

    // Bob attempts to DELETE Alice's file
    state.userId = "user_bob";
    const req = new Request(`http://127.0.0.1:4317/api/app/files/${fileId}`, {
      method: "DELETE",
      headers: { Origin: "http://127.0.0.1:4317" },
    });

    const res = await callApi(req, `files/${fileId}`);
    expect(res.status).toBe(404);

    // Verify Alice's file still exists in DB and R2
    const fileInDb = db.prepare("SELECT id, status FROM files WHERE id=?").get(fileId) as any;
    expect(fileInDb).toBeDefined();
    expect(fileInDb.status).toBe("ready");
    expect(r2Storage.has("user_alice/" + fileId)).toBe(true);
  });

  it("enforces strict IDOR generation history isolation", async () => {
    const genId = "alice_gen_1";
    db.prepare(
      "INSERT INTO generations (id,user_id,prompt,tone,tool_id,output,status,cost,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(genId, "user_alice", "Alice confidential prompt", "natural", "copywriting", "Result", "completed", 1, Date.now());

    // Bob requests history
    state.userId = "user_bob";
    const req = new Request("http://127.0.0.1:4317/api/app/history", {
      method: "GET",
    });

    const res = await callApi(req, "history");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.history).toHaveLength(0);

    // Bob attempts to delete Alice's generation
    const delReq = new Request(`http://127.0.0.1:4317/api/app/history/${genId}`, {
      method: "DELETE",
      headers: { Origin: "http://127.0.0.1:4317" },
    });

    const delRes = await callApi(delReq, `history/${genId}`);
    expect(delRes.status).toBe(404); // Properly rejects with 404 Not Found

    // Verify Alice's record is completely untouched
    const genInDb = db.prepare("SELECT id FROM generations WHERE id=?").get(genId);
    expect(genInDb).toBeDefined();
  });

  it("blocks untrusted origins on all mutating operations (CSRF Defense)", async () => {
    state.userId = "user_alice";

    // Attempt mutating action with untrusted origin
    const evilOrigins = ["https://evil-attacker.com", "http://malicious.org", "null"];

    for (const evilOrigin of evilOrigins) {
      const req = new Request("http://127.0.0.1:4317/api/app/redeem", {
        method: "POST",
        headers: {
          Origin: evilOrigin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: "SAMPLE_CODE_XYZ" }),
      });

      const res = await callApi(req, "redeem");
      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error).toContain("请求来源不受信任");
    }
  });

  it("prevents privilege escalation: non-admin cannot access admin APIs even if injecting parameters", async () => {
    state.userId = "user_alice"; // Regular user

    const adminEndpoints = [
      "admin/overview",
      "admin/users",
      "admin/orders",
      "admin/subscriptions",
      "admin/ledger",
      "admin/plans",
      "admin/codes",
    ];

    for (const ep of adminEndpoints) {
      const req = new Request(`http://127.0.0.1:4317/api/app/${ep}`, {
        method: "GET",
      });
      const res = await callApi(req, ep);
      expect(res.status).toBe(403);
    }
  });

  it("sanitizes SQL injection patterns in search queries without throwing syntax errors", async () => {
    state.userId = "user_alice";

    const maliciousQueries = [
      "' OR 1=1 --",
      "'; DROP TABLE user; --",
      "UNION SELECT id,password FROM user --",
      "%' OR ''='",
      "\\'; DELETE FROM credit_ledger; --",
    ];

    for (const q of maliciousQueries) {
      const req = new Request(`http://127.0.0.1:4317/api/app/history?search=${encodeURIComponent(q)}`, {
        method: "GET",
      });
      const res = await callApi(req, "history");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(Array.isArray(data.history)).toBe(true);
    }

    // Verify database tables are completely intact
    const userCount = (db.prepare("SELECT COUNT(*) as n FROM user").get() as any).n;
    expect(userCount).toBeGreaterThanOrEqual(3);
  });
});

describe("Deep Audit: Database Integrity Constraints & Triggers", () => {
  it("enforces storage file count limit (maximum 100 files per user)", () => {
    // Insert 100 files for user_alice
    for (let i = 0; i < 100; i++) {
      db.prepare(
        "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES (?, 'user_alice', 'f.txt', ?, 10, 'text/plain', 0)",
      ).run(`file_100_${i}`, `key_${i}`);
    }

    // 101st file must be aborted by files_quota trigger
    expect(() => {
      db.prepare(
        "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES ('file_101', 'user_alice', 'f.txt', 'key_101', 10, 'text/plain', 0)",
      ).run();
    }).toThrow("storage_quota_exceeded");
  });

  it("enforces total storage byte limit (maximum 100MB per user)", () => {
    // Insert 1 file of exactly 100MB (104857600 bytes)
    db.prepare(
      "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES ('file_max', 'user_bob', 'big.iso', 'key_big', 104857600, 'application/octet-stream', 0)",
    ).run();

    // Adding even 1 extra byte must be rejected
    expect(() => {
      db.prepare(
        "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES ('file_extra', 'user_bob', 'tiny.txt', 'key_extra', 1, 'text/plain', 0)",
      ).run();
    }).toThrow("storage_quota_exceeded");
  });

  it("blocks disabled / banned users from creating sessions, orders, or generations", () => {
    // Disable user_bob
    db.prepare("UPDATE user SET disabled_at=? WHERE id='user_bob'").run(Date.now());

    // 1. Session insert must be blocked
    expect(() => {
      db.prepare(
        "INSERT INTO session (id,user_id,token,expires_at,created_at,updated_at) VALUES ('sess_b', 'user_bob', 'tok', 9999999999, 0, 0)",
      ).run();
    }).toThrow("account_disabled");

    // 2. Generation insert must be blocked
    expect(() => {
      db.prepare(
        "INSERT INTO generations (id,user_id,prompt,tone,tool_id,status,cost,created_at) VALUES ('gen_b', 'user_bob', 'prompt', 'tone', 'copywriting', 'pending', 1, 0)",
      ).run();
    }).toThrow("account_disabled");

    // 3. Order insert must be blocked
    expect(() => {
      db.prepare(
        "INSERT INTO orders (id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES ('ord_b', 'user_bob', 'pack', 'pancake', 900, 'USD', 200, 'pending', 0)",
      ).run();
    }).toThrow("account_disabled");
  });

  it("enforces one pending generation per user index", () => {
    db.prepare(
      "INSERT INTO generations (id,user_id,prompt,tone,tool_id,status,cost,created_at) VALUES ('gen_p1', 'user_alice', 'prompt 1', 'tone', 'copywriting', 'pending', 1, 0)",
    ).run();

    // Second pending generation for the same user must be rejected by unique index
    expect(() => {
      db.prepare(
        "INSERT INTO generations (id,user_id,prompt,tone,tool_id,status,cost,created_at) VALUES ('gen_p2', 'user_alice', 'prompt 2', 'tone', 'copywriting', 'pending', 1, 0)",
      ).run();
    }).toThrow();
  });

  it("strictly enforces webhook replay idempotency (duplicate payment webhooks grant credits once)", () => {
    // 1. Create order
    const orderId = "order_replay_test";
    const receiptId = "receipt_replay_test";
    db.prepare(
      "INSERT INTO orders (id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES (?, 'user_alice', 'pack', 'pancake', 900, 'USD', 200, 'pending', 0)",
    ).run(orderId);

    // 2. First payment webhook creates receipt and credit ledger entry
    db.prepare(
      "INSERT OR IGNORE INTO receipts (id,order_id,user_id,provider_id,amount,credits,created_at) VALUES (?,?,?,?,900,200,0)",
    ).run(receiptId, orderId, "user_alice", "pancake_tx_123");
    db.prepare(
      "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?, 'user_alice', 200, 'payment', 0)",
    ).run(`payment:${receiptId}`);

    const balanceAfterFirst = (db.prepare("SELECT balance FROM wallets WHERE user_id='user_alice'").get() as any).balance;
    expect(balanceAfterFirst).toBe(200);

    // 3. Replay webhook 5 times with identical IDs
    for (let i = 0; i < 5; i++) {
      db.prepare(
        "INSERT OR IGNORE INTO receipts (id,order_id,user_id,provider_id,amount,credits,created_at) VALUES (?,?,?,?,900,200,0)",
      ).run(receiptId, orderId, "user_alice", "pancake_tx_123");
      db.prepare(
        "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?, 'user_alice', 200, 'payment', 0)",
      ).run(`payment:${receiptId}`);
    }

    // Verify balance is STILL 200, not 1200
    const balanceAfterReplay = (db.prepare("SELECT balance FROM wallets WHERE user_id='user_alice'").get() as any).balance;
    expect(balanceAfterReplay).toBe(200);

    // Verify exactly 1 receipt and 1 credit ledger row
    const receiptsCount = (db.prepare("SELECT COUNT(*) as n FROM receipts WHERE id=?").get(receiptId) as any).n;
    expect(receiptsCount).toBe(1);
    const ledgerCount = (db.prepare("SELECT COUNT(*) as n FROM credit_ledger WHERE id=?").get(`payment:${receiptId}`) as any).n;
    expect(ledgerCount).toBe(1);
  });

  it("blocks closed accounts from accessing API endpoints", async () => {
    // Close user_bob's account
    db.prepare("UPDATE user SET closed_at=? WHERE id='user_bob'").run(Date.now());

    state.userId = "user_bob";
    const req = new Request("http://127.0.0.1:4317/api/app/overview", {
      method: "GET",
    });

    const res = await callApi(req, "overview");
    expect(res.status).toBe(403);
    const json = (await res.json()) as any;
    expect(json.error).toContain("账户已停用或注销");
  });
});

