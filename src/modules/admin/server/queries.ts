import "@tanstack/react-start/server-only";
import { decryptCode } from "@/modules/redemption/server/code-vault";
import { codeHash } from "@/modules/redemption/server/service";
import { currentEntitlement } from "@/modules/entitlements/server/service";
import { getPlan } from "@/modules/billing/server/plans";
import type { AdminUserDetail, UserRecord } from "../types";
import { z } from "zod";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";
import { requireAdmin } from "@/modules/auth/server/session";
import {
  orderStatuses,
  subscriptionStatuses,
  paymentProviders,
} from "../types";
import { taskStatuses } from "../types";
import type {
  AdminTask,
  TaskDetail,
  AdminLedger,
  AdminCode,
  AdminRedemption,
  AdminOverview,
  AdminAiModelUsage,
} from "../types";
import type {
  AdminPage,
  AdminUser,
  AdminOrder,
  AdminSubscription,
  AdminAudit,
} from "../types";

const pageSize = 25;
const cursorSchema = z
  .object({
    time: z.number().int().nonnegative(),
    id: z.string().min(1).max(256),
  })
  .strict();
function input(request: Request, allowedStatuses: Record<string, string> = {}) {
  const result = z
    .object({
      search: z.string().trim().max(256).default(""),
      status: z.string().max(64).default(""),
      provider: z.string().max(32).default(""),
      cursor: z.string().max(1000).optional(),
    })
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!result.success) throw new HttpError(400, "查询条件不正确。");
  const { status, provider } = result.data;
  if (
    (status && !Object.hasOwn(allowedStatuses, status)) ||
    (provider && !Object.hasOwn(paymentProviders, provider))
  )
    throw new HttpError(400, "请选择有效的状态或支付渠道。");
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (result.data.cursor) {
    try {
      cursor = cursorSchema.parse(
        JSON.parse(
          Buffer.from(result.data.cursor, "base64url").toString("utf8"),
        ),
      );
    } catch {
      throw new HttpError(400, "分页信息无效，请重新查询。");
    }
  }
  return { ...result.data, cursor };
}
async function page<T extends { id: string }>(
  select: string,
  conditions: string[],
  values: (string | number)[],
  timeColumn: string,
  idColumn: string,
  cursor: z.infer<typeof cursorSchema> | undefined,
  timeKey: keyof T,
): Promise<AdminPage<T>> {
  if (cursor) {
    conditions.push(`(${timeColumn},${idColumn}) < (?,?)`);
    values.push(cursor.time, cursor.id);
  }
  const sql = `${select}${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""} ORDER BY ${timeColumn} DESC,${idColumn} DESC LIMIT ?`;
  const rows = (
    await bindings()
      .DB.prepare(sql)
      .bind(...values, pageSize + 1)
      .all<T>()
  ).results;
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > pageSize && last
        ? Buffer.from(
            JSON.stringify({ time: last[timeKey], id: last.id }),
          ).toString("base64url")
        : null,
  };
}
const userSelect = `SELECT u.id,u.name,u.email,u.email_verified,u.created_at,u.closed_at,u.disabled_at,COALESCE(w.balance,0) AS balance,
 (SELECT provider_id FROM account WHERE user_id=u.id ORDER BY created_at,id LIMIT 1) AS registration_provider,
 EXISTS(SELECT 1 FROM account WHERE user_id=u.id AND provider_id='google') AS has_google,
 EXISTS(SELECT 1 FROM account WHERE user_id=u.id AND provider_id='credential') AS has_password
 FROM user u LEFT JOIN wallets w ON u.id=w.user_id`;

export async function listAdminUsers(request: Request) {
  await requireAdmin(request);
  const q = input(request, {
    active: "active",
    closed: "closed",
    disabled: "disabled",
  });
  const where: string[] = [],
    values: (string | number)[] = [];
  if (q.provider) throw new HttpError(400, "用户查询不支持支付渠道。");
  if (q.search) {
    where.push("(u.id=? OR u.email=?)");
    values.push(q.search, q.search);
  }
  if (q.status === "closed") where.push("u.closed_at IS NOT NULL");
  if (q.status === "active")
    where.push("u.closed_at IS NULL AND u.disabled_at IS NULL");
  if (q.status === "disabled")
    where.push("u.closed_at IS NULL AND u.disabled_at IS NOT NULL");
  return page<AdminUser>(
    userSelect,
    where,
    values,
    "u.created_at",
    "u.id",
    q.cursor,
    "created_at",
  );
}
export async function listAdminOrders(request: Request) {
  await requireAdmin(request);
  const q = input(request, orderStatuses);
  const where: string[] = [],
    values: (string | number)[] = [];
  if (q.search) {
    where.push(
      "(o.id=? OR o.provider_id=? OR o.user_id=? OR o.user_id IN (SELECT id FROM user WHERE email=?))",
    );
    values.push(q.search, q.search, q.search, q.search);
  }
  if (q.status) {
    where.push("o.status=?");
    values.push(q.status);
  }
  if (q.provider) {
    where.push("o.provider=?");
    values.push(q.provider);
  }
  return page<AdminOrder>(
    "SELECT o.id,o.user_id,u.name,u.email,o.plan_id,o.plan_name,o.billing_interval,o.provider,o.provider_id,o.amount,o.currency,o.credits,o.status,o.created_at FROM orders o JOIN user u ON u.id=o.user_id",
    where,
    values,
    "o.created_at",
    "o.id",
    q.cursor,
    "created_at",
  );
}
export async function listAdminSubscriptions(request: Request) {
  await requireAdmin(request);
  const q = input(request, subscriptionStatuses);
  const where: string[] = [],
    values: (string | number)[] = [];
  if (q.search) {
    where.push(
      "(s.id=? OR s.provider_id=? OR s.order_id=? OR s.user_id=? OR s.user_id IN (SELECT id FROM user WHERE email=?))",
    );
    values.push(q.search, q.search, q.search, q.search, q.search);
  }
  if (q.status) {
    where.push("s.status=?");
    values.push(q.status);
  }
  if (q.provider) {
    where.push("o.provider=?");
    values.push(q.provider);
  }
  return page<AdminSubscription>(
    "SELECT s.id,s.user_id,u.name,u.email,s.order_id,o.plan_name,o.billing_interval,o.provider,s.provider_id,s.plan_id,s.status,s.paid_until,s.updated_at FROM subscriptions s JOIN orders o ON o.id=s.order_id JOIN user u ON u.id=s.user_id",
    where,
    values,
    "s.updated_at",
    "s.id",
    q.cursor,
    "updated_at",
  );
}
export async function listAdminAudit(request: Request) {
  await requireAdmin(request);
  const q = input(request, {
    credit_grant: "积分调整",
    "account.closed": "账户注销",
    user: "用户操作",
    plan: "套餐配置",
    code: "兑换操作",
    order: "订单核对",
  });
  const where: string[] = [],
    values: (string | number)[] = [];
  if (q.provider) throw new HttpError(400, "操作记录不支持支付渠道。");
  if (q.search) {
    where.push(
      "(a.actor_id=? OR a.target_id=? OR a.actor_id IN (SELECT id FROM user WHERE email=?) OR a.target_id IN (SELECT id FROM user WHERE email=?))",
    );
    values.push(q.search, q.search, q.search, q.search);
  }
  if (q.status === "credit_grant") where.push("a.action LIKE 'credit_grant:%'");
  if (["user", "plan", "code", "order"].includes(q.status)) {
    where.push("a.action LIKE ?");
    values.push(q.status + ".%");
  }
  if (q.status === "account.closed") where.push("a.action='account.closed'");
  return page<AdminAudit>(
    "SELECT a.id,a.actor_id,actor.name AS actor_name,actor.email AS actor_email,a.target_id,target.name AS target_name,target.email AS target_email,a.action,a.created_at FROM audit_logs a LEFT JOIN user actor ON actor.id=a.actor_id LEFT JOIN user target ON target.id=a.target_id",
    where,
    values,
    "a.created_at",
    "a.id",
    q.cursor,
    "created_at",
  );
}

export async function listAdminTasks(request: Request) {
  await requireAdmin(request);
  const q = input(request, taskStatuses),
    where: string[] = [],
    values: (string | number)[] = [];
  if (q.provider) throw new HttpError(400, "任务不支持支付渠道。");
  if (q.search) {
    where.push(
      "(g.id=? OR g.user_id=? OR g.user_id IN (SELECT id FROM user WHERE email=?))",
    );
    values.push(q.search, q.search, q.search);
  }
  if (q.status) {
    where.push("g.status=?");
    values.push(q.status);
  }
  return page<AdminTask>(
    "SELECT g.id,g.user_id,u.name,u.email,g.tool_id,g.status,g.cost,g.model,g.prompt_tokens,g.completion_tokens,g.total_tokens,g.cost_micros,g.created_at,g.completed_at,g.error_code,(SELECT COALESCE(SUM(amount),0) FROM credit_ledger WHERE id='release:'||g.id) AS refunded FROM generations g JOIN user u ON u.id=g.user_id",
    where,
    values,
    "g.created_at",
    "g.id",
    q.cursor,
    "created_at",
  );
}
export async function taskDetail(request: Request, id: string) {
  await requireAdmin(request);
  if (id.length > 128) throw new HttpError(400, "任务编号无效。");
  const row = await bindings()
    .DB.prepare(
      "SELECT g.id,g.user_id,u.name,u.email,g.tool_id,g.status,g.cost,g.model,g.prompt_tokens,g.completion_tokens,g.total_tokens,g.cost_micros,g.created_at,g.completed_at,g.error_code,g.prompt,g.output,g.tone FROM generations g JOIN user u ON u.id=g.user_id WHERE g.id=?",
    )
    .bind(id)
    .first<TaskDetail>();
  if (!row) throw new HttpError(404, "任务不存在或已删除。");
  return row;
}
export async function listAdminLedger(request: Request) {
  await requireAdmin(request);
  const q = input(request, { in: "增加", out: "扣减" }),
    where: string[] = [],
    values: (string | number)[] = [];
  if (q.provider) throw new HttpError(400, "积分流水不支持支付渠道。");
  if (q.search) {
    where.push(
      "(l.id=? OR l.user_id=? OR l.user_id IN (SELECT id FROM user WHERE email=?))",
    );
    values.push(q.search, q.search, q.search);
  }
  if (q.status) where.push(q.status === "in" ? "l.amount>0" : "l.amount<0");
  return page<AdminLedger>(
    "SELECT l.id,l.user_id,u.name,u.email,l.amount,l.reason,l.created_at,r.order_id FROM credit_ledger l JOIN user u ON u.id=l.user_id LEFT JOIN refund_events f ON f.id=l.id LEFT JOIN credit_installments i ON i.id=CASE WHEN l.id LIKE 'installment:%' THEN substr(l.id,13) WHEN l.id LIKE 'refund:installment:%' THEN substr(l.id,20) END LEFT JOIN receipts r ON r.id=CASE WHEN l.id LIKE 'payment:%' THEN substr(l.id,9) ELSE COALESCE(f.receipt_id,i.receipt_id) END",
    where,
    values,
    "l.created_at",
    "l.id",
    q.cursor,
    "created_at",
  );
}
function readCode(ciphertext: string | null, id: string) {
  if (!ciphertext) return { code: null, code_status: "legacy" as const };
  try {
    return { code: decryptCode(ciphertext, id), code_status: "ready" as const };
  } catch {
    return { code: null, code_status: "unavailable" as const };
  }
}
function revealRedemption<
  T extends { code_id: string; code_ciphertext: string | null },
>(record: T) {
  const { code_ciphertext, ...row } = record;
  return { ...row, ...readCode(code_ciphertext, row.code_id) };
}
export async function listAdminCodes(request: Request) {
  await requireAdmin(request);
  const q = input(request, {
      available: "可兑换",
      disabled: "已停用",
      expired: "已过期",
      exhausted: "已用完",
    }),
    where: string[] = [],
    values: (string | number)[] = [];
  if (q.search) {
    where.push("(c.id=? OR c.name=? OR c.code_hash=?)");
    values.push(q.search, q.search, codeHash(q.search));
  }
  if (q.status === "available") {
    where.push("c.disabled_at IS NULL AND c.expires_at>? AND c.used<1");
    values.push(Date.now());
  }
  if (q.status === "disabled")
    where.push("c.disabled_at IS NOT NULL AND c.used<1");
  if (q.status === "expired") {
    where.push("c.expires_at<=? AND c.used<1");
    values.push(Date.now());
  }
  if (q.status === "exhausted") where.push("c.used>=1");
  const result = await page<AdminCode & { code_ciphertext: string | null }>(
    "SELECT c.id,c.code_ciphertext,c.hint,c.name,c.kind,c.plan_id,c.plan_name,c.credits,c.grant_months,c.term_months,c.days,c.max_uses,c.used,c.expires_at,c.disabled_at,c.created_at FROM redeem_codes c",
    where,
    values,
    "c.created_at",
    "c.id",
    q.cursor,
    "created_at",
  );
  return {
    ...result,
    items: result.items.map(({ code_ciphertext, ...row }) => {
      return { ...row, ...readCode(code_ciphertext, row.id) };
    }),
  };
}
export async function listAdminRedemptions(request: Request) {
  await requireAdmin(request);
  const q = input(request),
    where: string[] = [],
    values: (string | number)[] = [];
  if (q.search) {
    where.push(
      "(r.code_id=? OR r.user_id=? OR r.user_id IN (SELECT id FROM user WHERE email=?) OR r.code_id IN (SELECT id FROM redeem_codes WHERE code_hash=?))",
    );
    values.push(q.search, q.search, q.search, codeHash(q.search));
  }
  const result = await page<
    AdminRedemption & { code_ciphertext: string | null }
  >(
    "SELECT r.id,r.user_id,u.name,u.email,r.code_id,c.name AS code_name,c.code_ciphertext,c.hint,r.credits,r.grant_months,r.plan_name,r.expires_at,r.created_at FROM redemptions r JOIN user u ON u.id=r.user_id JOIN redeem_codes c ON c.id=r.code_id",
    where,
    values,
    "r.created_at",
    "r.id",
    q.cursor,
    "created_at",
  );
  return { ...result, items: result.items.map(revealRedemption) };
}
export async function adminOverview(request: Request): Promise<AdminOverview> {
  await requireAdmin(request);
  const p = z
    .object({ days: z.enum(["1", "7", "30"]).default("7") })
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!p.success) throw new HttpError(400, "请选择最近 1、7 或 30 天。");
  const until = Date.now(),
    from = until - Number(p.data.days) * 86400000,
    db = bindings().DB;
  const results = await db.batch([
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM user WHERE created_at>=? AND created_at<=?",
      )
      .bind(from, until),
    db
      .prepare(
        "SELECT COUNT(*) AS count,COALESCE(SUM(status='paid'),0) AS paid,COALESCE(SUM(status='pending'),0) AS pending FROM orders WHERE created_at>=? AND created_at<=?",
      )
      .bind(from, until),
    db
      .prepare(
        "SELECT COUNT(*) AS count,COALESCE(SUM(status='completed'),0) AS completed,COALESCE(SUM(status='failed'),0) AS failed,COALESCE(SUM(status='pending'),0) AS pending,COALESCE(SUM(status='blocked'),0) AS blocked,COALESCE(SUM(total_tokens),0) AS total_tokens,COALESCE(SUM(cost_micros),0) AS total_cost_micros FROM generations WHERE created_at>=? AND created_at<=?",
      )
      .bind(from, until),
    db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) AS issued,COALESCE(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END),0) AS spent FROM credit_ledger WHERE created_at>=? AND created_at<=?",
      )
      .bind(from, until),
    db
      .prepare(
        "SELECT currency,SUM(received) AS received,SUM(refunded) AS refunded FROM (SELECT o.currency,SUM(r.amount) AS received,0 AS refunded FROM receipts r JOIN orders o ON o.id=r.order_id WHERE r.created_at>=? AND r.created_at<=? GROUP BY o.currency UNION ALL SELECT o.currency,0 AS received,SUM(f.amount) AS refunded FROM refund_events f JOIN receipts r ON r.id=f.receipt_id JOIN orders o ON o.id=r.order_id WHERE f.created_at>=? AND f.created_at<=? GROUP BY o.currency) GROUP BY currency",
      )
      .bind(from, until, from, until),
    db
      .prepare(
        "SELECT date(created_at/1000,'unixepoch','+8 hours') AS day,COUNT(*) AS count,SUM(status='completed') AS completed FROM generations WHERE created_at>=? AND created_at<=? GROUP BY day ORDER BY day",
      )
      .bind(from, until),
    db
      .prepare(
        `SELECT
          COALESCE(NULLIF(model,''), 'default') AS model,
          COUNT(*) AS total_count,
          COALESCE(SUM(status='completed'),0) AS completed_count,
          COALESCE(SUM(status='failed'),0) AS failed_count,
          COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
          COALESCE(SUM(completion_tokens),0) AS completion_tokens,
          COALESCE(SUM(total_tokens),0) AS total_tokens,
          COALESCE(SUM(cost_micros),0) AS cost_micros,
          COALESCE(SUM(cost),0) AS credits_charged,
          AVG(CASE WHEN completed_at IS NOT NULL AND completed_at>=created_at THEN completed_at-created_at ELSE NULL END) AS avg_duration_ms
        FROM generations
        WHERE created_at>=? AND created_at<=?
        GROUP BY model
        ORDER BY total_count DESC`,
      )
      .bind(from, until),
  ]);
  return {
    from,
    until,
    users: results[0].results[0],
    orders: results[1].results[0],
    tasks: results[2].results[0],
    credits: results[3].results[0],
    revenue: results[4].results,
    daily: results[5].results,
    aiUsage: (results[6]?.results || []) as unknown as AdminAiModelUsage[],
  } as AdminOverview;
}

export async function adminUserDetail(
  request: Request,
  userId: string,
): Promise<AdminUserDetail> {
  await requireAdmin(request);
  if (!userId || userId.length > 128)
    throw new HttpError(400, "用户信息无效。");
  const user = await bindings()
    .DB.prepare(userSelect + " WHERE u.id=?")
    .bind(userId)
    .first<AdminUser>();
  if (!user) throw new HttpError(404, "用户不存在。");
  const [entitlement, starter] = await Promise.all([
    currentEntitlement(userId),
    getPlan("starter"),
  ]);
  return { user, entitlement, freePlanName: starter.name };
}
export async function adminUserRecords(
  request: Request,
  userId: string,
  kind: string,
) {
  await requireAdmin(request);
  const sources: Record<string, string> = {
    tasks:
      "SELECT g.id,g.created_at,g.status,g.tool_id,g.cost,g.completed_at,(SELECT COALESCE(SUM(amount),0) FROM credit_ledger WHERE id='release:'||g.id) AS refunded FROM generations g",
    ledger: "SELECT g.id,g.created_at,g.amount,g.reason FROM credit_ledger g",
    orders:
      "SELECT g.id,g.created_at,g.status,g.amount,g.credits,g.plan_name,g.billing_interval,g.provider FROM orders g",
    subscriptions:
      "SELECT g.id,g.status,g.plan_id,g.order_id,g.paid_until,g.updated_at,o.plan_name,o.billing_interval,o.provider FROM subscriptions g JOIN orders o ON o.id=g.order_id AND o.user_id=g.user_id",
    redemptions:
      "SELECT g.id,g.created_at,g.credits,g.grant_months,g.plan_name,g.expires_at,g.code_id,c.name AS code_name,c.code_ciphertext,c.hint,u.email,u.name FROM redemptions g JOIN redeem_codes c ON c.id=g.code_id JOIN user u ON u.id=g.user_id",
  };
  if (!Object.hasOwn(sources, kind))
    throw new HttpError(404, "记录类型不存在。");
  if (!userId || userId.length > 128)
    throw new HttpError(400, "用户信息无效。");
  const q = input(request);
  if (q.search || q.status || q.provider)
    throw new HttpError(400, "用户详情仅支持分页查询。");
  if (
    !(await bindings()
      .DB.prepare("SELECT id FROM user WHERE id=?")
      .bind(userId)
      .first())
  )
    throw new HttpError(404, "用户不存在。");
  const timeKey = kind === "subscriptions" ? "updated_at" : "created_at";
  const result = await page<
    UserRecord & { code_id: string; code_ciphertext: string | null }
  >(
    sources[kind],
    ["g.user_id=?"],
    [userId],
    `g.${timeKey}`,
    "g.id",
    q.cursor,
    timeKey,
  );
  if (kind === "redemptions")
    return { ...result, items: result.items.map(revealRedemption) };
  return result;
}
