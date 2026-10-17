import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
const state = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({ bindings: () => state.env }));
import {
  upload,
  download,
  remove,
  listFiles,
} from "@/modules/files/server/service";
let db: DatabaseSync;
const objects = new Map<
  string,
  { size: number; customMetadata?: Record<string, string>; body: Uint8Array }
>();
const storage = {
  put: vi.fn(
    async (
      key: string,
      body: ArrayBuffer,
      options: { customMetadata: Record<string, string> },
    ) => {
      objects.set(key, {
        size: body.byteLength,
        customMetadata: options.customMetadata,
        body: new Uint8Array(body),
      });
    },
  ),
  head: vi.fn(async (key: string) => objects.get(key) ?? null),
  get: vi.fn(async (key: string) => objects.get(key) ?? null),
  delete: vi.fn(async (key: string) => {
    objects.delete(key);
  }),
};
function statement(sql: string, args: unknown[] = []): any {
  return {
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...(args as any[])) ?? null,
    run: async () => ({
      meta: {
        changes: Number(db.prepare(sql).run(...(args as any[])).changes),
      },
    }),
    all: async () => ({ results: db.prepare(sql).all(...(args as any[])) }),
  };
}
beforeEach(() => {
  objects.clear();
  vi.clearAllMocks();
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("migrations/" + file, "utf8"));
  db.exec(
    "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('u','Test','u@example.test',1,0,0),('v','Other','v@example.test',1,0,0)",
  );
  state.env = { DB: { prepare: statement }, FILES: storage };
});
afterEach(() => db.close());
function reservation(id: string, status = "uploading", size = 4, age = 360000) {
  db.prepare(
    "INSERT INTO files (id,user_id,name,key,size,content_type,created_at,status,updated_at) VALUES (?,'u','sample.txt',?,?,'text/plain',0,?,?)",
  ).run(id, "u/" + id, size, status, Date.now() - age);
}
function object(id: string, size = 4, owner = "u") {
  objects.set("u/" + id, {
    size,
    customMetadata: { fileId: id, ownerId: owner, size: String(size) },
    body: new Uint8Array(size),
  });
}
function request() {
  const form = new FormData();
  form.append("file", new File(["text"], "sample.txt", { type: "text/plain" }));
  return new Request("http://localhost/upload", { method: "POST", body: form });
}
const status = (id: string) =>
  db.prepare("SELECT status FROM files WHERE id=?").get(id)?.status;

describe("private files with manual retry", () => {
  it("publishes completed uploads without returning capacity counters", async () => {
    const { id } = await upload(request(), "u");
    expect(status(id)).toBe("ready");
    const result = await listFiles("u");
    expect(result.files).toHaveLength(1);
    expect(result).not.toHaveProperty("usage");
  });
  it("keeps failed uploads visible for manual deletion without automatic retries", async () => {
    storage.put.mockRejectedValueOnce(new Error("storage unavailable"));
    storage.delete.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(upload(request(), "u")).rejects.toMatchObject({ status: 502 });
    const rows = (await listFiles("u")).files as {
      id: string;
      status: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("deleting");
    expect(storage.delete).toHaveBeenCalledTimes(1);
    await remove(rows[0].id, "u");
    expect((await listFiles("u")).files).toHaveLength(0);
  });
  it("reports failed deletion and lets the owner explicitly retry", async () => {
    reservation("f", "ready");
    object("f");
    storage.delete.mockRejectedValueOnce(new Error("private-provider-details"));
    await expect(remove("f", "u")).rejects.toMatchObject({
      status: 502,
      message: "删除未完成，请稍后再次点击删除。",
    });
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect((await listFiles("u")).files).toHaveLength(1);
    await expect(download("f", "u")).rejects.toMatchObject({ status: 404 });
    await expect(remove("f", "u")).resolves.toEqual({ ok: true });
    expect(objects.size).toBe(0);
  });
  it("isolates owners and forces attachment downloads", async () => {
    reservation("f", "ready");
    object("f");
    await expect(download("f", "v")).rejects.toMatchObject({ status: 404 });
    await expect(remove("f", "v")).rejects.toMatchObject({ status: 404 });
    expect((await listFiles("v")).files).toHaveLength(0);
    expect(
      (await download("f", "u")).headers.get("Content-Disposition"),
    ).toContain("attachment;");
  });
  it("keeps the existing quota constraint under simultaneous uploads", async () => {
    reservation("full", "ready", 100 * 1024 * 1024 - 4);
    const results = await Promise.allSettled([
      upload(request(), "u"),
      upload(request(), "u"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { status: 409 },
    });
    expect(storage.put).toHaveBeenCalledTimes(1);
  });
  it("preserves rows when database deletion fails for a later manual retry", async () => {
    reservation("f", "ready");
    object("f");
    const original = state.env.DB;
    state.env.DB = {
      prepare: (sql: string) => {
        if (sql.startsWith("DELETE FROM files"))
          throw new Error("db unavailable");
        return statement(sql);
      },
    };
    await expect(remove("f", "u")).rejects.toMatchObject({ status: 502 });
    expect(status("f")).toBe("deleting");
    state.env.DB = original;
    await remove("f", "u");
    expect(status("f")).toBeUndefined();
  });
  it("protects active uploads but lets the owner delete abandoned reservations", async () => {
    reservation("f", "uploading", 4, 0);
    await expect(remove("f", "u")).rejects.toMatchObject({ status: 409 });
    expect(storage.delete).not.toHaveBeenCalled();
    db.exec("UPDATE files SET updated_at=0 WHERE id='f'");
    await remove("f", "u");
    expect(status("f")).toBeUndefined();
  });
});
