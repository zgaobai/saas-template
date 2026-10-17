import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const aiLine = readFileSync(".dev.vars", "utf8")
  .split("\n")
  .find((line) => line.startsWith("OPENAI_API_KEY="));
if (
  aiLine
    ?.slice(aiLine.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "")
)
  throw new Error("Use a local test environment without an AI key");
const base = process.env.SMOKE_URL || "http://127.0.0.1:4317";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Local development only");
const suffix = randomBytes(6).toString("hex");
function client() {
  let cookie = "";
  return async (path, options = {}) => {
    const response = await fetch(base + path, {
      ...options,
      headers: {
        Origin: base,
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers,
      },
      redirect: "manual",
    });
    const set = response.headers.getSetCookie();
    if (set.length) cookie = set.map((s) => s.split(";")[0]).join("; ");
    return response;
  };
}
const anon = client(),
  alice = client(),
  bob = client();
const json = (data) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// Wait for server to become ready
let serverReady = false;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(base + "/api/health");
    if (res.ok) {
      serverReady = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!serverReady) throw new Error(`Dev server at ${base} is not ready.`);

const rootResponse = await anon("/");
assert.equal(rootResponse.status, 302, "Root path should redirect to localized path");
assert.equal((await anon("/zh/")).status, 200);
assert.equal((await anon("/en/")).status, 200);
assert.equal((await anon("/api/health")).status, 200);
for (const tool of [
  "copywriting",
  "rewrite",
  "summarize",
  "translate",
  "email",
  "social",
  "image",
  "video",
  "audio",
]) {
  assert.equal((await anon(`/zh/tools/${tool}`)).status, 200);
  assert.equal((await anon(`/en/tools/${tool}`)).status, 200);
}
assert.equal((await anon("/zh/tools/not-a-tool")).status, 404);
assert.equal((await anon("/api/app/overview")).status, 401);
for (const [request, name] of [
  [alice, "alice"],
  [bob, "bob"],
]) {
  const response = await request(
    "/api/auth/sign-up/email",
    json({
      name: "工具站验证",
      email: `${name}-${suffix}@example.test`,
      password: crypto.randomUUID() + "!Local",
    }),
  );
  assert.equal(response.status, 200, "Local registration should succeed");
}
assert.equal((await (await alice("/api/app/overview")).json()).balance, 20);

for (const endpoint of [
  "/api/app/billing",
  "/api/app/credits",
  "/api/app/history?status=failed",
]) {
  const response = await alice(endpoint);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control") ?? "", /\bno-store\b/);
}
const userInfo = await (await alice("/api/app/billing")).json();
assert.equal(userInfo.balance, 20);
assert.equal(typeof userInfo.freePlanName, "string");
assert.deepEqual(userInfo.redemptions, []);
const creditView = await (await alice("/api/app/credits")).json();
assert.equal(creditView.summary.earned, 20);
assert.equal(creditView.summary.returned, 0);
for (const action of [
  "user-status",
  "plans",
  "codes",
  "code-status",
  "reconcile",
])
  assert.equal((await alice(`/api/app/admin/${action}`, json({}))).status, 403);
assert.equal(
  (await alice("/api/app/redeem", json({ code: "INVALID".repeat(5) }))).status,
  400,
);

for (const page of [
  "overview",
  "users",
  "orders",
  "subscriptions",
  "audit",
  "tasks",
  "ledger",
  "plans",
  "codes",
  "redemptions",
])
  assert.equal((await alice(`/api/app/admin/${page}`)).status, 403);
assert.equal(
  (
    await alice("/api/app/generate", {
      ...json({}),
      headers: {
        Origin: "https://untrusted.invalid",
        "Content-Type": "application/json",
      },
    })
  ).status,
  403,
);
assert.equal(
  (
    await alice(
      "/api/app/generate",
      json({
        requestId: crypto.randomUUID(),
        toolId: "unknown",
        prompt: "合法长度的测试输入",
        tone: "自然清晰",
      }),
    )
  ).status,
  400,
);
// Missing credentials must fail without spending a credit; do not call a paid AI service here.
const generation = await alice(
  "/api/app/generate",
  json({
    requestId: crypto.randomUUID(),
    toolId: "summarize",
    prompt: "这个测试环境未配置模型凭据。",
    tone: "自然清晰",
  }),
);
assert.equal(
  generation.status,
  503,
  "Run with no AI key to verify fail-closed behavior",
);
assert.equal((await (await alice("/api/app/overview")).json()).balance, 20);
const form = new FormData();
form.set(
  "file",
  new Blob(["local-tool-file-check"], { type: "text/plain" }),
  "check.txt",
);
const uploaded = await alice("/api/app/files", { method: "POST", body: form });
assert.equal(uploaded.status, 200);
const { id } = await uploaded.json();
assert.ok(id);
assert.equal(
  await (await alice(`/api/app/files/${id}`)).text(),
  "local-tool-file-check",
);
assert.equal((await bob(`/api/app/files/${id}`)).status, 404);
assert.equal(
  (await bob(`/api/app/files/${id}`, { method: "DELETE" })).status,
  404,
);
assert.equal(
  (await alice(`/api/app/files/${id}`, { method: "DELETE" })).status,
  200,
);
assert.equal((await alice(`/api/app/files/${id}`)).status, 404);
const history = await (await alice("/api/app/history?search=测试")).json();
assert.ok(Array.isArray(history.history));
const files = await (await alice("/api/app/files")).json();
assert.deepEqual(files.files, []);
assert.equal("usage" in files, false);
const recovered = await (
  await alice("/api/app/billing/reconcile", json({}))
).json();
assert.equal(recovered.checked, 0);
assert.equal((await alice("/api/app/account/export")).status, 404);
// Close only the fresh dedicated smoke account; no existing user is touched.
assert.equal(
  (
    await bob(
      "/api/app/account/close",
      json({ email: `bob-${suffix}@example.test`, confirmation: "DELETE" }),
    )
  ).status,
  200,
);
assert.equal((await bob("/api/app/overview")).status, 401);
assert.equal((await alice("/api/auth/sign-out", json({}))).status, 200);
assert.equal((await alice("/api/app/overview")).status, 401);
console.log(
  "PASS: public tools, registration, credits, auth, admin isolation, origin checks, tool validation, missing AI, R2 owner isolation, deletion, history, file list, reconciliation, removed export endpoint, account closure, sign-out.",
);
