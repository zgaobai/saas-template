import { describe, it, expect, beforeEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  userId: "admin" as string | null,
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
              },
            }
          : null,
    },
  }),
}));

const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: any[]) => mockGenerateText(...args),
}));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => ({
    chat: (model: string) => ({ type: "chat", model }),
    responses: (model: string) => ({ type: "responses", model }),
  })),
}));

import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  getActiveAiConfig,
  getAdminAiConfig,
  saveAdminAiConfig,
  testAdminAiConnection,
} from "@/modules/admin/server/ai-config";

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

const postRequest = (data: unknown) =>
  new Request("https://app.test/api/app/admin/ai-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const f of readdirSync("migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync("migrations/" + f, "utf8"));
  }

  for (const id of ["admin", "alice"]) {
    db.prepare(
      "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)",
    ).run(id, id, id + "@example.test", now, now);
  }

  state.userId = "admin";
  state.env = {
    ADMIN_USER_IDS: "admin",
    REDEMPTION_ENCRYPTION_KEY: "a".repeat(64),
    OPENAI_API_KEY: "sk-env-fallback-1234567890",
    AI_MODEL: "gpt-4.1-mini",
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
});

describe("AI Gateway Configuration Center", () => {
  it("encrypts, decrypts and masks API keys accurately", () => {
    const rawKey = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
    const encrypted = encryptApiKey(rawKey);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted).not.toContain(rawKey);

    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(rawKey);

    const masked = maskApiKey(rawKey);
    expect(masked).toBe("sk-proj…wxyz");
    expect(maskApiKey("short")).toBe("sk-****");
    expect(maskApiKey("   ")).toBe("");
  });

  it("blocks non-admin users from all AI configuration endpoints", async () => {
    state.userId = "alice"; // regular user

    const req = new Request("https://app.test/api/app/admin/ai-config");
    await expect(getAdminAiConfig(req)).rejects.toThrow("你没有管理员权限。");
    await expect(saveAdminAiConfig(postRequest({}))).rejects.toThrow(
      "你没有管理员权限。",
    );
    await expect(testAdminAiConnection(postRequest({}))).rejects.toThrow(
      "你没有管理员权限。",
    );
  });

  it("returns fallback status when database has no saved config", async () => {
    const req = new Request("https://app.test/api/app/admin/ai-config");
    const result = await getAdminAiConfig(req);
    expect(result.config.source).toBe("environment");
    expect(result.config.hasApiKey).toBe(true);
    expect(result.config.apiKeyHint).toBe(
      maskApiKey("sk-env-fallback-1234567890"),
    );

    // Active AI config seamlessly uses environment variables
    const active = await getActiveAiConfig();
    expect(active?.source).toBe("environment");
    expect(active?.apiKey).toBe("sk-env-fallback-1234567890");
    expect(active?.model).toBe("gpt-4.1-mini");
  });

  it("saves, encrypts, updates and audits AI gateway configuration with multi-model lists", async () => {
    const saveReq = postRequest({
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: "sk-custom-secret-key-999888777",
      apiStyle: "chat",
      textModels: [
        {
          id: "deepseek-ai/DeepSeek-V3",
          name: "DeepSeek V3 (主力推荐)",
          isDefault: true,
        },
        {
          id: "deepseek-ai/DeepSeek-R1",
          name: "DeepSeek R1 (深度思考)",
          isDefault: false,
        },
      ],
      imageModels: [
        {
          id: "black-forest-labs/FLUX.1-schnell",
          name: "FLUX.1 极速版",
          isDefault: true,
        },
      ],
      videoModels: [
        {
          id: "kling-v1",
          name: "快手可灵 Kling",
          isDefault: true,
        },
      ],
      audioModels: [
        {
          id: "suno-v3.5",
          name: "Suno 音乐",
          isDefault: true,
        },
      ],
      enabled: true,
    });

    const res = await saveAdminAiConfig(saveReq);
    expect(res.ok).toBe(true);

    // Verify raw database record
    const row = db
      .prepare(
        "SELECT base_url, api_key_ciphertext, api_key_hint, text_model, text_models_json, enabled FROM ai_configs WHERE id='default'",
      )
      .get() as any;
    expect(row.base_url).toBe("https://api.siliconflow.cn/v1");
    expect(row.api_key_ciphertext.startsWith("v1.")).toBe(true);
    expect(row.api_key_ciphertext).not.toContain("sk-custom-secret-key-999888777");
    expect(row.api_key_hint).toBe("sk-cust…8777");
    expect(row.text_model).toBe("deepseek-ai/DeepSeek-V3");
    expect(row.text_models_json).toContain("DeepSeek R1");
    expect(row.enabled).toBe(1);

    // Verify audit log recorded
    const audit = db
      .prepare(
        "SELECT action, target_id FROM audit_logs WHERE target_id='ai_configs:default'",
      )
      .get() as any;
    expect(audit.action).toBe("ai_config.updated:deepseek-ai/DeepSeek-V3");

    // Hot config resolution now returns database values and default text model
    const activeDefault = await getActiveAiConfig();
    expect(activeDefault?.source).toBe("database");
    expect(activeDefault?.apiKey).toBe("sk-custom-secret-key-999888777");
    expect(activeDefault?.baseURL).toBe("https://api.siliconflow.cn/v1");
    expect(activeDefault?.model).toBe("deepseek-ai/DeepSeek-V3");
    expect(activeDefault?.textModels.length).toBe(2);

    // Requesting a specific model in the allowed list resolves that model
    const activeR1 = await getActiveAiConfig("deepseek-ai/DeepSeek-R1");
    expect(activeR1?.model).toBe("deepseek-ai/DeepSeek-R1");

    // Requesting an unknown model safely falls back to primary default
    const activeFallback = await getActiveAiConfig("nonexistent-model");
    expect(activeFallback?.model).toBe("deepseek-ai/DeepSeek-V3");

    // Admin UI query returns masked hint without exposing raw key, and includes model lists
    const configRes = await getAdminAiConfig(
      new Request("https://app.test/api/app/admin/ai-config"),
    );
    expect(configRes.config.source).toBe("database");
    expect(configRes.config.hasApiKey).toBe(true);
    expect(configRes.config.apiKeyHint).toBe("sk-cust…8777");
    expect(configRes.config.textModels.length).toBe(2);
    expect(configRes.config.imageModels[0].id).toBe("black-forest-labs/FLUX.1-schnell");
    expect((configRes.config as any).apiKey).toBeUndefined();

    // Partial update without retyping API key keeps existing key and updates models
    await saveAdminAiConfig(
      postRequest({
        baseUrl: "https://api.siliconflow.cn/v1",
        apiKey: "", // empty means keep existing
        apiStyle: "chat",
        textModels: [
          {
            id: "deepseek-ai/DeepSeek-R1",
            name: "DeepSeek R1 (升级主力)",
            isDefault: true,
          },
        ],
        enabled: true,
      }),
    );
    const activeAfterUpdate = await getActiveAiConfig();
    expect(activeAfterUpdate?.model).toBe("deepseek-ai/DeepSeek-R1");
    expect(activeAfterUpdate?.apiKey).toBe("sk-custom-secret-key-999888777");

    // Disabling admin config falls back to environment
    await saveAdminAiConfig(
      postRequest({
        baseUrl: "https://api.siliconflow.cn/v1",
        apiKey: "",
        apiStyle: "chat",
        textModels: [
          {
            id: "deepseek-ai/DeepSeek-R1",
            name: "DeepSeek R1",
            isDefault: true,
          },
        ],
        enabled: false,
      }),
    );
    const activeDisabled = await getActiveAiConfig();
    expect(activeDisabled?.source).toBe("environment");
    expect(activeDisabled?.apiKey).toBe("sk-env-fallback-1234567890");
  });

  it("performs connectivity ping testing against AI gateway", async () => {
    // 1. When no key provided and none available
    state.env.OPENAI_API_KEY = "";
    const emptyReq = postRequest({
      baseUrl: "https://api.test.com",
      apiKey: "",
      apiStyle: "chat",
      textModel: "deepseek-chat",
    });
    await expect(testAdminAiConnection(emptyReq)).rejects.toThrow(
      "请先输入 API 密钥再进行连通性测试。",
    );

    // 2. Successful test
    mockGenerateText.mockResolvedValueOnce({
      text: "OK",
    });
    const testReq = postRequest({
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: "sk-test-key-12345",
      apiStyle: "chat",
      textModel: "deepseek-ai/DeepSeek-V3",
    });
    const successRes = await testAdminAiConnection(testReq);
    expect(successRes.ok).toBe(true);
    expect(successRes.response).toBe("OK");
    expect(typeof successRes.latencyMs).toBe("number");

    // 3. Gateway error handled gracefully without throwing 500
    mockGenerateText.mockRejectedValueOnce(new Error("401 Unauthorized: Invalid key"));
    const failRes = await testAdminAiConnection(
      postRequest({
        baseUrl: "https://api.siliconflow.cn/v1",
        apiKey: "sk-test-key-12345",
        apiStyle: "chat",
        textModel: "deepseek-ai/DeepSeek-V3",
      }),
    );
    expect(failRes.ok).toBe(false);
    expect(failRes.error).toContain("401 Unauthorized");
  });
});
