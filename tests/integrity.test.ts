import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import {
  cents,
  checkoutUrl,
  assertPayment,
} from "../src/modules/billing/validation";
let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const name of readdirSync("migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`migrations/${name}`, "utf8"));
  db.exec(
    "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('u','Test','u@example.test',1,0,0); INSERT INTO wallets VALUES ('u',0)",
  );
});
afterEach(() => db.close());
const credit = (id: string, amount: number) =>
  db
    .prepare("INSERT OR IGNORE INTO credit_ledger VALUES (?,?,?,?,?)")
    .run(id, "u", amount, "test", 0);
const balance = () => db.prepare("SELECT balance FROM wallets").get()?.balance;
function receipt() {
  db.exec(
    "INSERT INTO orders (id,user_id,plan_id,provider,amount,currency,credits,status,created_at) VALUES ('o','u','pack','pancake',900,'USD',200,'paid',0); INSERT INTO receipts (id,order_id,user_id,provider_id,amount,credits,created_at) VALUES ('r','o','u','pay',900,200,0)",
  );
  credit("payment:r", 200);
}
describe("credit and billing integrity", () => {
  it("duplicate payment grants only once", () => {
    credit("payment:x", 200);
    credit("payment:x", 200);
    expect(balance()).toBe(200);
  });
  it("rejects overdrafts without mutating balance", () => {
    credit("welcome", 1);
    credit("gen:1", -1);
    expect(() => credit("gen:2", -1)).toThrow("insufficient_credits");
    expect(balance()).toBe(0);
  });
  it("rolls back job and debit together on insufficient credits", () => {
    db.exec("BEGIN");
    try {
      db.exec(
        "INSERT INTO generations (id,user_id,prompt,tone,output,status,cost,created_at) VALUES ('g','u','prompt','tone',NULL,'pending',1,0)",
      );
      credit("gen:g", -1);
      db.exec("COMMIT");
    } catch {
      db.exec("ROLLBACK");
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM generations").get()?.n).toBe(
      0,
    );
  });
  it("permits only one active generation per user", () => {
    db.exec(
      "INSERT INTO generations (id,user_id,prompt,tone,output,status,cost,created_at) VALUES ('g','u','prompt','tone',NULL,'pending',1,0)",
    );
    expect(() =>
      db.exec(
        "INSERT INTO generations (id,user_id,prompt,tone,output,status,cost,created_at) VALUES ('h','u','prompt','tone',NULL,'pending',1,0)",
      ),
    ).toThrow();
  });
  it("deduplicates refunds and computes cumulative partial revocation", () => {
    receipt();
    const refund = db.prepare(
      "INSERT OR IGNORE INTO refund_events VALUES (?,?,?,?)",
    );
    refund.run("refund:1", "r", 450, 1);
    refund.run("refund:1", "r", 450, 1);
    expect(balance()).toBe(100);
    refund.run("refund:2", "r", 450, 2);
    expect(balance()).toBe(0);
    expect(db.prepare("SELECT status FROM orders").get()?.status).toBe(
      "refunded",
    );
  });
  it("rejects refunds exceeding the actual receipt", () => {
    receipt();
    expect(() =>
      db.exec("INSERT INTO refund_events VALUES ('refund:1','r',901,0)"),
    ).toThrow("invalid_refund_amount");
    expect(balance()).toBe(200);
  });
  it("refund debt blocks future usage rather than losing the refund", () => {
    receipt();
    credit("gen:spent", -190);
    db.exec("INSERT INTO refund_events VALUES ('refund:1','r',900,0)");
    expect(balance()).toBe(-190);
    expect(() => credit("gen:new", -1)).toThrow();
  });
  it("enforces storage quota in the database", () => {
    db.exec(
      "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES ('f','u','f.txt','key',104857600,'text/plain',0)",
    );
    expect(() =>
      db.exec(
        "INSERT INTO files (id,user_id,name,key,size,content_type,created_at) VALUES ('g','u','g.txt','key2',1,'text/plain',0)",
      ),
    ).toThrow("storage_quota_exceeded");
  });
});
describe("payment contract validation", () => {
  it("uses integer cents without float rounding", () => {
    expect(cents("19.00")).toBe(1900);
    expect(cents("0.09")).toBe(9);
    expect(() => cents("1e3")).toThrow();
    expect(() => cents("-1")).toThrow();
  });
  it("rejects mismatched price and currency", () => {
    expect(() =>
      assertPayment(
        { amount: 900, currency: "USD" },
        { amount: "9.00", currency: "EUR" },
      ),
    ).toThrow();
    expect(() =>
      assertPayment(
        { amount: 900, currency: "USD" },
        { amount: "0.01", currency: "USD" },
      ),
    ).toThrow();
  });
  it("only accepts HTTPS checkout redirects", () => {
    expect(checkoutUrl('{"webUrl":"https://checkout.waffo.ai/test"}')).toBe(
      "https://checkout.waffo.ai/test",
    );
    expect(() => checkoutUrl("javascript:alert(1)")).toThrow();
    expect(() => checkoutUrl("https://user:secret@example.com")).toThrow();
  });
});
