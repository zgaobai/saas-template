import { nextCreditGrant } from "@/modules/billing/server/installments";
import "@tanstack/react-start/server-only";
import { requireUser, requireAdmin } from "@/modules/auth/server/session";
import { assertOrigin, body, HttpError } from "./http";
import { bindings } from "./env";
import { balance } from "@/modules/credits/server/service";
import { currentEntitlement } from "@/modules/entitlements/server/service";
import { recoverStale, generate } from "@/modules/tools/server/generation";
import {
  checkout,
  cancelSubscription,
  recoverBilling,
} from "@/modules/billing/server/service";
import {
  upload,
  download,
  remove,
  listFiles,
} from "@/modules/files/server/service";
import { personalLedger } from "@/modules/account/server/ledger";
import { personalBillingRecords } from "@/modules/account/server/billing-records";
import {
  listHistory,
  deleteHistory,
} from "@/modules/history/server/service";
import {
  createCode,
  setCodeStatus,
  redeem,
} from "@/modules/redemption/server/service";
import {
  setUserStatus,
  updatePlan,
  reconcileOrder,
} from "@/modules/admin/server/actions";
import { getPlans, getPlan } from "@/modules/billing/server/plans";
import { z } from "zod";
import { limitRequest } from "./rate-limit";
import {
  getAdminAiConfig,
  saveAdminAiConfig,
  testAdminAiConnection,
  getPublicAiModels,
} from "@/modules/admin/server/ai-config";
import {
  getActiveAnnouncement,
  listAdminAnnouncements,
  saveAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
} from "@/modules/admin/server/announcements";
import {
  getDiagnostics,
  testFeishuWebhook,
  testEmailService,
} from "@/modules/admin/server/diagnostics";
import {
  submitFeedback,
  listAdminFeedbacks,
  updateFeedbackStatus,
} from "@/modules/feedback/server/service";
import { closeAccount } from "@/modules/account/server/close";
import {
  adminUserDetail,
  adminUserRecords,
  listAdminUsers,
  listAdminTasks,
  taskDetail,
  listAdminLedger,
  listAdminCodes,
  listAdminRedemptions,
  adminOverview,
  listAdminOrders,
  listAdminSubscriptions,
  listAdminAudit,
} from "@/modules/admin/server/queries";
export async function appApi(request: Request, path: string) {
  const method = request.method;
  if (method === "GET" && path === "public/announcements/active") {
    return { announcement: await getActiveAnnouncement() };
  }
  if (method === "POST" && path === "feedback") {
    assertOrigin(request);
    return submitFeedback(request);
  }
  const u = await requireUser(request);
  const db = bindings().DB;
  if (method !== "GET") {
    assertOrigin(request);
    await limitRequest(u.id, "write", 40, 60000);
  }
  if (method === "POST" && path === "generate")
    await limitRequest(u.id, "generate", 10, 60000);
  if (method === "POST" && path === "files")
    await limitRequest(u.id, "upload", 10, 60000);
  if (method === "GET" && path === "credits")
    return personalLedger(request, u.id);
  if (method === "GET" && path === "billing/records")
    return personalBillingRecords(request, u.id);
  if (method === "GET" && path === "billing/summary") {
    const [credits, entitlement, starter, nextGrant] = await Promise.all([
      balance(u.id),
      currentEntitlement(u.id),
      getPlan("starter"),
      nextCreditGrant(u.id),
    ]);
    return {
      balance: credits,
      entitlement,
      freePlanName: starter.name,
      nextGrant,
    };
  }
  if (method === "GET" && path === "ai/models") {
    return getPublicAiModels();
  }
  if (method === "GET" && path === "history") {
    await recoverStale(u.id);
    return listHistory(request, u.id);
  }
  if (method === "DELETE" && path.startsWith("history/"))
    return deleteHistory(path.slice(8), u.id);
  if (method === "POST" && path === "account/close") {
    await limitRequest(u.id, "close-account", 3, 3600000);
    return closeAccount(request, u.id);
  }
  if (method === "GET" && path === "overview") {
    await recoverStale(u.id);
    const [credits, entitlement, history] = await Promise.all([
      balance(u.id),
      currentEntitlement(u.id),
      db
        .prepare(
          "SELECT id,prompt,tone,tool_id,output,status,created_at FROM generations WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
        )
        .bind(u.id)
        .all(),
    ]);
    return { balance: credits, entitlement, history: history.results };
  }
  if (method === "POST" && path === "generate") return generate(request, u.id);
  if (method === "POST" && path === "checkout") return checkout(request, u);
  if (method === "POST" && path === "cancel-subscription")
    return cancelSubscription(request, u.id);
  if (method === "POST" && path === "billing/reconcile") {
    await limitRequest(u.id, "billing-reconcile", 3, 60000);
    return recoverBilling(u.id);
  }
  if (method === "GET" && path === "billing") {
    const [
      credits,
      orders,
      subscriptions,
      ledger,
      redemptions,
      entitlement,
      starter,
      nextGrant,
    ] = await Promise.all([
      balance(u.id),
      db
        .prepare(
          "SELECT id,plan_id,plan_name,provider,provider_id,checkout_url,amount,currency,status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(u.id)
        .all(),
      db
        .prepare(
          "SELECT s.id,s.plan_id,o.plan_name,s.status,s.paid_until FROM subscriptions s JOIN orders o ON o.id=s.order_id WHERE s.user_id=? ORDER BY s.updated_at DESC",
        )
        .bind(u.id)
        .all(),
      db
        .prepare(
          "SELECT id,amount,reason,created_at FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(u.id)
        .all(),
      db
        .prepare(
          "SELECT id,credits,grant_months,starts_at,plan_id,plan_name,expires_at,created_at FROM redemptions WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(u.id)
        .all(),
      currentEntitlement(u.id),
      getPlan("starter"),
      nextCreditGrant(u.id),
    ]);
    return {
      balance: credits,
      freePlanName: starter.name,
      nextGrant,
      redemptions: redemptions.results,
      entitlement,
      orders: orders.results,
      subscriptions: subscriptions.results,
      ledger: ledger.results,
    };
  }
  if (path === "files" && method === "GET") return listFiles(u.id);
  if (path === "files" && method === "POST") return upload(request, u.id);
  if (path.startsWith("files/") && method === "GET")
    return download(path.slice(6), u.id);
  if (path.startsWith("files/") && method === "DELETE")
    return remove(path.slice(6), u.id);
  if (method === "POST" && path === "redeem") {
    await limitRequest(u.id, "redeem", 5, 60000);
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) await limitRequest(clientIp, "redeem-ip", 30, 60000);
    return redeem(request, u.id);
  }
  if (method === "POST") {
    if (path === "admin/user-status") return setUserStatus(request);
    if (path === "admin/plans/create") return updatePlan(request, true);
    if (path === "admin/plans") return updatePlan(request);
    if (path === "admin/payments/toggle") {
      const admin = await requireAdmin(request);
      const input = z
        .object({ enabled: z.boolean() })
        .parse(await body(request));
      const { setPaymentsActive } = await import(
        "@/modules/admin/server/system-settings"
      );
      await setPaymentsActive(input.enabled, admin.id);
      return { ok: true, paymentsActive: input.enabled };
    }
    if (path === "admin/ai-config") return saveAdminAiConfig(request);
    if (path === "admin/ai-test") return testAdminAiConnection(request);
    if (path === "admin/codes") return createCode(request);
    if (path === "admin/code-status") return setCodeStatus(request);
    if (path === "admin/reconcile") {
      await limitRequest(u.id, "admin-reconcile", 5, 60000);
      return reconcileOrder(request);
    }
    if (path === "admin/announcements") return saveAnnouncement(request);
    if (path === "admin/announcements/toggle") return toggleAnnouncement(request);
    if (path === "admin/diagnostics/feishu-test") return testFeishuWebhook(request);
    if (path === "admin/diagnostics/email-test") return testEmailService(request);
    if (path === "admin/feedbacks/status") return updateFeedbackStatus(request);
  }
  if (method === "GET") {
    if (path === "admin/overview") return adminOverview(request);
    if (path === "admin/tasks") return listAdminTasks(request);
    if (path.startsWith("admin/tasks/"))
      return taskDetail(request, path.slice(12));
    if (path === "admin/ledger") return listAdminLedger(request);
    if (path === "admin/codes") return listAdminCodes(request);
    if (path === "admin/redemptions") return listAdminRedemptions(request);
    if (path === "admin/plans") {
      await requireAdmin(request);
      const { isPaymentsActive } = await import(
        "@/modules/admin/server/system-settings"
      );
      return {
        plans: await getPlans(),
        activeProvider: bindings().PAYMENT_PROVIDER || "pancake",
        paymentsActive: await isPaymentsActive(),
      };
    }
    if (path === "admin/users") return listAdminUsers(request);
    const userPath =
      /^admin\/users\/([^/]+)(?:\/(tasks|ledger|orders|subscriptions|redemptions))?$/.exec(
        path,
      );
    if (userPath)
      return userPath[2]
        ? adminUserRecords(request, userPath[1], userPath[2])
        : adminUserDetail(request, userPath[1]);
    if (path === "admin/orders") return listAdminOrders(request);
    if (path === "admin/subscriptions") return listAdminSubscriptions(request);
    if (path === "admin/audit") return listAdminAudit(request);
    if (path === "admin/ai-config") return getAdminAiConfig(request);
    if (path === "admin/announcements") return listAdminAnnouncements(request);
    if (path === "admin/diagnostics") return getDiagnostics(request);
    if (path === "admin/feedbacks") return listAdminFeedbacks(request);
  }
  if (method === "DELETE" && path.startsWith("admin/announcements/")) {
    return deleteAnnouncement(request, path.slice(20));
  }
  if (path === "admin/credits" && method === "POST") {
    const admin = await requireAdmin(request);
    const input = z
      .object({
        userId: z.string().min(1),
        amount: z.number().int().min(1).max(10000),
        reason: z.string().trim().min(3).max(120),
        requestId: z.string().uuid(),
      })
      .strict()
      .safeParse(await body(request));
    if (!input.success)
      throw new HttpError(400, "请输入有效用户、积分和调整原因。");
    const d = input.data;
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO wallets (user_id,balance) VALUES (?,0)")
        .bind(d.userId),
      db
        .prepare(
          "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          `admin:${d.requestId}`,
          d.userId,
          d.amount,
          `管理员调整：${d.reason}`,
          Date.now(),
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO audit_logs (id,actor_id,action,target_id,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          d.requestId,
          admin.id,
          `credit_grant:${d.amount}:${d.reason}`,
          d.userId,
          Date.now(),
        ),
    ]);
    return { ok: true };
  }
  throw new HttpError(404, "未找到此接口。");
}
