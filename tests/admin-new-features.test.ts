import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  userId: "admin-user" as string | null,
  userEmail: "admin@example.com",
  userName: "Admin User",
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/server/env", () => ({
  bindings: () => state.env,
  paymentConfigured: (provider?: string) => {
    if (provider === "pancake") return true;
    return false;
  },
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
                email: state.userEmail,
                name: state.userName,
              },
            }
          : null,
    },
  }),
}));

import {
  saveAnnouncement,
  getActiveAnnouncement,
  listAdminAnnouncements,
  toggleAnnouncement,
  deleteAnnouncement,
} from "@/modules/admin/server/announcements";
import {
  submitFeedback,
  listAdminFeedbacks,
  updateFeedbackStatus,
} from "@/modules/feedback/server/service";
import {
  getDiagnostics,
  testFeishuWebhook,
  testEmailService,
} from "@/modules/admin/server/diagnostics";
import { adminOverview } from "@/modules/admin/server/queries";

let db: DatabaseSync;

function statement(sql: string, args: any[] = []): any {
  return {
    sql,
    args,
    bind: (...values: any[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => {
      const res = db.prepare(sql).run(...args);
      return { meta: { changes: res.changes } };
    },
  };
}

function addUser(id: string, email: string, name: string) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO user(id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
  ).run(id, name, email, now, now);
}

function createRequest(url: string, method = "GET", bodyData?: any, headers: Record<string, string> = {}) {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (bodyData !== undefined) {
    init.body = JSON.stringify(bodyData);
  }
  return new Request(url, init);
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=OFF");

  const files = readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  }

  addUser("admin-user", "admin@example.com", "Admin User");
  addUser("regular-user", "user@example.com", "Regular User");

  state.userId = "admin-user";
  state.userEmail = "admin@example.com";
  state.userName = "Admin User";

  state.env = {
    ADMIN_USER_IDS: "admin-user",
    APP_URL: "https://saas.example.com",
    FEISHU_WEBHOOK_URL: "https://open.feishu.cn/open-apis/bot/v2/hook/abcdef-1234-5678",
    FEISHU_WEBHOOK_SECRET: "my-test-secret",
    RESEND_API_KEY: "re_test_1234567890abcdef",
    EMAIL_FROM: "notify@saas.example.com",
    GOOGLE_CLIENT_ID: "123456789-abc.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "GOCSPX-secret123",
    PAYMENT_PROVIDER: "pancake",
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

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("Admin Announcements Feature", () => {
  it("creates, retrieves, toggles, and deletes site announcements", async () => {
    // 1. Initially no active announcement
    const initialActive = await getActiveAnnouncement();
    expect(initialActive).toBeNull();

    // 2. Create an announcement
    const reqCreate = createRequest("https://saas.example.com/api/app/admin/announcements", "POST", {
      title: "全新 FLUX.1 图像生成上线",
      content: "首周享受五折优惠，欢迎体验！",
      type: "promotion",
      linkUrl: "/tools/image-generator",
      linkText: "立即体验 →",
      isActive: true,
      dismissible: true,
    });
    const createRes = await saveAnnouncement(reqCreate);
    expect(createRes.ok).toBe(true);
    expect(createRes.id).toBeDefined();

    // 3. Get active announcement
    const active = await getActiveAnnouncement();
    expect(active).not.toBeNull();
    expect(active?.title).toBe("全新 FLUX.1 图像生成上线");
    expect(active?.type).toBe("promotion");
    expect(active?.is_active).toBe(1);

    // 4. List admin announcements
    const reqList = createRequest("https://saas.example.com/api/app/admin/announcements");
    const listRes = await listAdminAnnouncements(reqList);
    expect(listRes.announcements).toHaveLength(1);
    expect(listRes.announcements[0].title).toBe("全新 FLUX.1 图像生成上线");

    // 5. Toggle active status to false
    const reqToggle = createRequest("https://saas.example.com/api/app/admin/announcements/toggle", "POST", {
      id: createRes.id,
      isActive: false,
    });
    const toggleRes = await toggleAnnouncement(reqToggle);
    expect(toggleRes.ok).toBe(true);

    const activeAfterToggle = await getActiveAnnouncement();
    expect(activeAfterToggle).toBeNull();

    // 6. Delete announcement
    const reqDelete = createRequest(`https://saas.example.com/api/app/admin/announcements/${createRes.id}`, "DELETE");
    const deleteRes = await deleteAnnouncement(reqDelete, createRes.id);
    expect(deleteRes.ok).toBe(true);

    const listAfterDelete = await listAdminAnnouncements(reqList);
    expect(listAfterDelete.announcements).toHaveLength(0);
  });

  it("blocks non-admin users from managing announcements", async () => {
    state.userId = "regular-user";
    state.userEmail = "user@example.com";

    const req = createRequest("https://saas.example.com/api/app/admin/announcements");
    await expect(listAdminAnnouncements(req)).rejects.toMatchObject({ status: 403 });
  });

  it("validates announcement payload constraints", async () => {
    const emptyTitleReq = createRequest("https://saas.example.com/api/app/admin/announcements", "POST", {
      title: "",
      content: "内容",
    });
    await expect(saveAnnouncement(emptyTitleReq)).rejects.toMatchObject({ status: 400 });
  });
});

describe("User Feedback & Admin Triage Feature", () => {
  it("allows users to submit feedback and admin to triage/update status", async () => {
    // 1. Regular user submits feedback
    state.userId = "regular-user";
    state.userEmail = "user@example.com";

    const submitReq = createRequest("https://saas.example.com/api/app/feedback", "POST", {
      type: "suggestion",
      title: "希望增加批量导出功能",
      content: "目前生成单张图片下载有点慢，希望能一键打包 ZIP 下载所有生成结果。",
      contact: "tg:@johndoe",
    });
    const submitRes = await submitFeedback(submitReq);
    expect(submitRes.ok).toBe(true);
    expect(submitRes.id).toBeDefined();

    // 2. Admin lists feedbacks
    state.userId = "admin-user";
    state.userEmail = "admin@example.com";

    const listReq = createRequest("https://saas.example.com/api/app/admin/feedbacks?status=all");
    const listRes = await listAdminFeedbacks(listReq);
    expect(listRes.items).toHaveLength(1);
    expect(listRes.items[0].title).toBe("希望增加批量导出功能");
    expect(listRes.items[0].user_email).toBe("user@example.com");
    expect(listRes.items[0].status).toBe("pending");

    // 3. Admin updates status and notes
    const updateReq = createRequest("https://saas.example.com/api/app/admin/feedbacks/status", "POST", {
      id: submitRes.id,
      status: "in_progress",
      adminNotes: "已排入下个 Sprint 需求评审池",
    });
    const updateRes = await updateFeedbackStatus(updateReq);
    expect(updateRes.ok).toBe(true);

    // 4. Verify filtered list by status
    const inProgressReq = createRequest("https://saas.example.com/api/app/admin/feedbacks?status=in_progress");
    const inProgressList = await listAdminFeedbacks(inProgressReq);
    expect(inProgressList.items).toHaveLength(1);
    expect(inProgressList.items[0].admin_notes).toBe("已排入下个 Sprint 需求评审池");

    const resolvedReq = createRequest("https://saas.example.com/api/app/admin/feedbacks?status=resolved");
    const resolvedList = await listAdminFeedbacks(resolvedReq);
    expect(resolvedList.items).toHaveLength(0);
  });

  it("validates feedback inputs and rejects invalid status values", async () => {
    state.userId = "regular-user";
    const invalidSubmit = createRequest("https://saas.example.com/api/app/feedback", "POST", {
      title: "太短",
      content: "短", // less than 5 chars
    });
    await expect(submitFeedback(invalidSubmit)).rejects.toMatchObject({ status: 400 });

    state.userId = "admin-user";
    const invalidStatus = createRequest("https://saas.example.com/api/app/admin/feedbacks/status", "POST", {
      id: "fake-id",
      status: "non_existent_status",
    });
    await expect(updateFeedbackStatus(invalidStatus)).rejects.toMatchObject({ status: 400 });
  });
});

describe("Admin Diagnostics Feature", () => {
  it("provides masked diagnostics and service health indicators", async () => {
    // Insert some dummy files and user
    db.prepare("INSERT INTO files(id, user_id, key, name, content_type, size, status, created_at, updated_at) VALUES ('f1', 'admin-user', 'k1', 'test.png', 'image/png', 2048, 'ready', 100, 100)").run();

    const req = createRequest("https://saas.example.com/api/app/admin/diagnostics");
    const report = await getDiagnostics(req);

    // Feishu
    expect(report.feishu.configured).toBe(true);
    expect(report.feishu.hasSecret).toBe(true);
    expect(report.feishu.webhookUrlMasked).toContain("open.feishu.cn");
    expect(report.feishu.webhookUrlMasked).not.toContain("1234-5678");

    // Email
    expect(report.email.configured).toBe(true);
    expect(report.email.emailFrom).toBe("notify@saas.example.com");
    expect(report.email.apiKeyMasked).toContain("re_tes****cdef");

    // Google
    expect(report.google.configured).toBe(true);
    expect(report.google.clientIdMasked).toContain("****");

    // Storage
    expect(report.storage.totalFiles).toBe(1);
    expect(report.storage.totalStorageBytes).toBe(2048);
    expect(report.storage.totalUsers).toBeGreaterThanOrEqual(2);
  });

  it("successfully fires Feishu webhook test card", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ StatusCode: 0, StatusMessage: "success" }),
    } as any);

    const req = createRequest("https://saas.example.com/api/app/admin/diagnostics/feishu-test", "POST");
    const result = await testFeishuWebhook(req);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = (global.fetch as any).mock.calls[0];
    expect(calledUrl).toBe(state.env.FEISHU_WEBHOOK_URL);
    const body = JSON.parse(calledInit.body);
    expect(body.msg_type).toBe("interactive");
    expect(body.card.header.title.content).toContain("连通性测试");
  });
});

describe("Admin AI Model Analytics Feature", () => {
  it("aggregates generations by foundation model with costs and token counts", async () => {
    const now = Date.now();
    // Insert generation records for different models
    // Model 1: gpt-4o-mini
    db.prepare(`
      INSERT INTO generations (
        id, user_id, tool_id, model, prompt, tone, status, cost,
        prompt_tokens, completion_tokens, total_tokens, cost_micros,
        created_at, completed_at
      ) VALUES (
        'gen-1', 'admin-user', 'chat', 'gpt-4o-mini', 'hello', 'friendly', 'completed', 5,
        100, 200, 300, 4500,
        ?, ?
      )
    `).run(now - 10000, now - 8000);

    db.prepare(`
      INSERT INTO generations (
        id, user_id, tool_id, model, prompt, tone, status, cost,
        prompt_tokens, completion_tokens, total_tokens, cost_micros,
        created_at, completed_at
      ) VALUES (
        'gen-2', 'admin-user', 'chat', 'gpt-4o-mini', 'tell me a joke', 'friendly', 'failed', 0,
        50, 0, 50, 750,
        ?, ?
      )
    `).run(now - 5000, now - 4000);

    // Model 2: flux-pro
    db.prepare(`
      INSERT INTO generations (
        id, user_id, tool_id, model, prompt, tone, status, cost,
        prompt_tokens, completion_tokens, total_tokens, cost_micros,
        created_at, completed_at
      ) VALUES (
        'gen-3', 'admin-user', 'image', 'flux-pro', 'a cyber city', 'vivid', 'completed', 20,
        0, 0, 0, 50000,
        ?, ?
      )
    `).run(now - 2000, now - 1000);

    const req = createRequest("https://saas.example.com/api/app/admin/overview?days=7");
    const overview = await adminOverview(req);

    expect(overview.aiUsage).toBeDefined();
    expect(overview.aiUsage?.length).toBe(2);

    const gpt = overview.aiUsage?.find((m) => m.model === "gpt-4o-mini");
    expect(gpt).toBeDefined();
    expect(gpt?.total_count).toBe(2);
    expect(gpt?.completed_count).toBe(1);
    expect(gpt?.failed_count).toBe(1);
    expect(gpt?.total_tokens).toBe(350);
    expect(gpt?.prompt_tokens).toBe(150);
    expect(gpt?.completion_tokens).toBe(200);
    expect(gpt?.cost_micros).toBe(5250);
    expect(gpt?.credits_charged).toBe(5);

    const flux = overview.aiUsage?.find((m) => m.model === "flux-pro");
    expect(flux).toBeDefined();
    expect(flux?.total_count).toBe(1);
    expect(flux?.completed_count).toBe(1);
    expect(flux?.cost_micros).toBe(50000);
    expect(flux?.credits_charged).toBe(20);
  });
});
