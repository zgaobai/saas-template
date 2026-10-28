import "@tanstack/react-start/server-only";
import { bindings, paymentConfigured } from "@/server/env";
import { requireAdmin } from "@/modules/auth/server/session";
import { HttpError } from "@/server/http";
import { sendAccountEmail } from "@/server/email";
import { sendFeishuTestNotification } from "@/modules/billing/server/feishu-notify";
import type { DiagnosticsReport } from "../types";

export type { DiagnosticsReport };

export async function getDiagnostics(request: Request): Promise<DiagnosticsReport> {
  await requireAdmin(request);
  const e = bindings();
  const db = e.DB;

  const feishuUrl = e.FEISHU_WEBHOOK_URL || "";
  let webhookUrlMasked = "";
  if (feishuUrl) {
    try {
      const u = new URL(feishuUrl);
      const parts = u.pathname.split("/");
      const last = parts.at(-1) || "";
      webhookUrlMasked = `${u.origin}/.../${last.slice(0, 4)}****${last.slice(-4)}`;
    } catch {
      webhookUrlMasked = "https://open.feishu.cn/...";
    }
  }

  const resendKey = e.RESEND_API_KEY || "";
  const apiKeyMasked = resendKey ? `${resendKey.slice(0, 6)}****${resendKey.slice(-4)}` : "";

  const googleId = e.GOOGLE_CLIENT_ID || "";
  const clientIdMasked = googleId ? `${googleId.slice(0, 10)}****${googleId.slice(-8)}` : "";

  const [filesStat, usersStat] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(*) AS total_files, COALESCE(SUM(size), 0) AS total_size FROM files WHERE status='ready'",
      )
      .first<{ total_files: number; total_size: number }>(),
    db.prepare("SELECT COUNT(*) AS total_users FROM user").first<{ total_users: number }>(),
  ]);

  return {
    feishu: {
      configured: Boolean(feishuUrl.trim()),
      webhookUrlMasked,
      hasSecret: Boolean(e.FEISHU_WEBHOOK_SECRET?.trim()),
    },
    email: {
      configured: Boolean(resendKey.trim() && e.EMAIL_FROM?.trim()),
      emailFrom: e.EMAIL_FROM || "",
      apiKeyMasked,
    },
    google: {
      configured: Boolean(googleId.trim() && e.GOOGLE_CLIENT_SECRET?.trim()),
      clientIdMasked,
    },
    payments: {
      activeProvider: e.PAYMENT_PROVIDER || "pancake",
      pancake: paymentConfigured("pancake"),
      stripe: paymentConfigured("stripe"),
      creem: paymentConfigured("creem"),
      paypal: paymentConfigured("paypal"),
    },
    storage: {
      dbOk: true,
      totalFiles: filesStat?.total_files || 0,
      totalStorageBytes: filesStat?.total_size || 0,
      totalUsers: usersStat?.total_users || 0,
    },
  };
}

export async function testFeishuWebhook(request: Request): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin(request);
  return sendFeishuTestNotification(admin.email);
}

export async function testEmailService(request: Request): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin(request);
  const e = bindings();
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) {
    throw new HttpError(400, "尚未配置 RESEND_API_KEY 或 EMAIL_FROM 环境变量。");
  }

  try {
    await sendAccountEmail(
      admin.email,
      "🧪 邮件服务连通性测试",
      `你好 ${admin.name || "管理员"}，这是一封来自管理后台的测试邮件。如果收到此邮件，说明 Resend 邮件服务与发件域名 (${e.EMAIL_FROM}) 已成功正常工作！`,
    );
    return { ok: true, message: `测试邮件已成功投递至 ${admin.email}！` };
  } catch (error) {
    throw new HttpError(502, `邮件投递失败: ${(error as Error).message}`);
  }
}
