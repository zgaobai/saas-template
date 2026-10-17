import "@tanstack/react-start/server-only";
import { z } from "zod";
import { bindings } from "@/server/env";
import { body, HttpError } from "@/server/http";
import { requireAdmin } from "@/modules/auth/server/session";
import { recoverBilling } from "@/modules/billing/server/service";
import { shortId } from "@/server/id";
import { getPlan } from "@/modules/billing/server/plans";
export async function setUserStatus(request: Request) {
  const admin = await requireAdmin(request);
  const p = z
    .object({
      userId: z.string().min(1).max(128),
      disabled: z.boolean(),
      reason: z.string().trim().min(3).max(120),
    })
    .strict()
    .safeParse(await body(request));
  if (!p.success) throw new HttpError(400, "请输入用户与操作原因。");
  const { userId, disabled, reason } = p.data,
    db = bindings().DB,
    now = Date.now();
  if (
    userId === admin.id ||
    (bindings().ADMIN_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .includes(userId)
  )
    throw new HttpError(409, "不能在此停用管理员账号。");
  const user = await db
    .prepare("SELECT closed_at FROM user WHERE id=?")
    .bind(userId)
    .first<{ closed_at: number | null }>();
  if (!user || user.closed_at !== null)
    throw new HttpError(404, "用户不存在或已注销。");
  await db.batch([
    db
      .prepare(
        "UPDATE user SET disabled_at=?,updated_at=? WHERE id=? AND closed_at IS NULL",
      )
      .bind(disabled ? now : null, now, userId),
    db.prepare("DELETE FROM session WHERE user_id=?").bind(userId),
    db
      .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        admin.id,
        `${disabled ? "user.disabled" : "user.enabled"}:${reason}`,
        userId,
        now,
      ),
  ]);
  return { ok: true };
}
const paymentBindingsSchema = z
  .object({
    pancake: z
      .string()
      .trim()
      .max(200)
      .regex(/^[A-Za-z0-9_-]*$/)
      .optional(),
    stripe: z
      .string()
      .trim()
      .max(200)
      .regex(/^(price_[A-Za-z0-9_]+)?$/)
      .optional(),
    creem: z
      .string()
      .trim()
      .max(200)
      .regex(/^[A-Za-z0-9_-]*$/)
      .optional(),
    paypal: z
      .string()
      .trim()
      .max(200)
      .regex(/^(P-[A-Za-z0-9-]+)?$/)
      .optional(),
  })
  .strict()
  .optional();
export async function updatePlan(request: Request, create = false) {
  const admin = await requireAdmin(request);
  const p = z
    .object({
      id: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,64}$/)
        .optional(),
      requestId: z.string().uuid().optional(),
      mode: z.enum(["free", "subscription", "payment"]).optional(),
      interval: z.enum(["month", "year"]).nullable().optional(),
      paymentBindings: paymentBindingsSchema,
      annualPaymentBindings: paymentBindingsSchema,
      annualPrice: z.number().int().min(1).max(10000000).nullable().optional(),
      name: z.string().trim().min(1).max(40),
      price: z.number().int().min(0).max(10000000),
      credits: z.number().int().min(0).max(1000000),
      description: z.string().trim().max(160),
      features: z.array(z.string().trim().min(1).max(100)).max(8),
      enabled: z.boolean(),
      revision: z.number().int().positive().optional(),
    })
    .strict()
    .safeParse(await body(request));
  if (!p.success)
    throw new HttpError(400, "请检查名称、金额、积分和套餐说明。");
  const d = p.data;
  const db = bindings().DB,
    now = Date.now();
  if (!create && (!d.id || !d.revision))
    throw new HttpError(400, "缺少套餐信息，请刷新后重试。");
  const current = create ? null : await getPlan(d.id!);
  const mode = current?.mode ?? d.mode;
  const interval = current?.interval ?? d.interval ?? null;
  if (!mode || (create && mode === "free"))
    throw new HttpError(
      400,
      "请选择订阅套餐或积分包；免费体验请编辑现有套餐。",
    );
  if (
    current &&
    ((d.mode && d.mode !== current.mode) ||
      (d.interval !== undefined && d.interval !== current.interval))
  )
    throw new HttpError(400, "已有套餐的计费类型不能改变，请添加新套餐。");
  if (interval === "year")
    throw new HttpError(
      400,
      "独立年付套餐已停用，请在订阅套餐内配置年付价格。",
    );
  if (mode === "subscription" ? !interval : interval !== null)
    throw new HttpError(400, "套餐类型与计费周期不匹配。");
  if (mode === "free" ? d.price !== 0 : d.price < 1 || d.credits < 1)
    throw new HttpError(
      400,
      "免费套餐价格必须为零，付费套餐金额与积分必须大于零。",
    );
  const mappings = d.paymentBindings ?? current?.paymentBindings ?? {};
  if (mode !== "subscription" && mappings.paypal)
    throw new HttpError(
      400,
      "PayPal Plan ID 仅用于订阅，积分包由订单接口直接收款。",
    );
  const annualPrice =
    d.annualPrice === undefined
      ? (current?.annualPrice ?? null)
      : d.annualPrice;
  const annualMappings =
    d.annualPaymentBindings ?? current?.annualPaymentBindings ?? {};
  if (
    annualPrice !== null &&
    (mode !== "subscription" ||
      interval !== "month" ||
      annualPrice > d.price * 12)
  )
    throw new HttpError(
      400,
      "年付选项仅用于订阅套餐，全年价格不能高于月价的 12 倍。",
    );
  if (annualPrice === null && Object.values(annualMappings).some(Boolean))
    throw new HttpError(400, "请先设置年付价格，再绑定年付商品。");
  if (create) {
    if (!d.requestId) throw new HttpError(400, "缺少创建请求标识。");
    const id = "plan_" + d.requestId.replaceAll("-", "");
    if (
      await db
        .prepare("SELECT id FROM plan_configs WHERE id=?")
        .bind(id)
        .first()
    )
      return { ok: true, id };
    const count = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM plan_configs WHERE billing_interval IS NULL OR billing_interval <> 'year'",
      )
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 100)
      throw new HttpError(409, "最多支持 100 个套餐，请编辑已有套餐。");
    await db.batch([
      db
        .prepare(
          "INSERT INTO plan_configs (id,name,mode,billing_interval,price,credits,description,features,enabled,revision,updated_at,payment_bindings,annual_price,annual_payment_bindings) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
        )
        .bind(
          id,
          d.name,
          mode,
          interval,
          d.price,
          d.credits,
          d.description,
          JSON.stringify(d.features),
          d.enabled ? 1 : 0,
          now,
          JSON.stringify(mappings),
          annualPrice,
          JSON.stringify(annualMappings),
        ),
      db
        .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
        .bind(shortId(), admin.id, "plan.created", id, now),
    ]);
    return { ok: true, id };
  }
  if (current!.revision !== d.revision)
    throw new HttpError(409, "套餐已被修改，请刷新后重试。");
  const result = await db.batch([
    db
      .prepare(
        "UPDATE plan_configs SET name=?,price=?,credits=?,description=?,features=?,enabled=?,payment_bindings=?,annual_price=?,annual_payment_bindings=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      )
      .bind(
        d.name,
        d.price,
        d.credits,
        d.description,
        JSON.stringify(d.features),
        d.enabled ? 1 : 0,
        JSON.stringify(mappings),
        annualPrice,
        JSON.stringify(annualMappings),
        now,
        d.id,
        d.revision,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1",
      )
      .bind(
        `plan:${d.id}:${d.revision! + 1}`,
        admin.id,
        `plan.updated:${d.revision! + 1}`,
        d.id,
        now,
      ),
  ]);
  if (!result[0].meta.changes)
    throw new HttpError(409, "套餐已被修改，请刷新后重试。");
  return { ok: true };
}
export async function reconcileOrder(request: Request) {
  const admin = await requireAdmin(request);
  const p = z
    .object({ id: z.string().min(1).max(128) })
    .strict()
    .safeParse(await body(request));
  if (!p.success) throw new HttpError(400, "订单信息不正确。");
  const db = bindings().DB,
    row = await db
      .prepare("SELECT user_id,status FROM orders WHERE id=?")
      .bind(p.data.id)
      .first<{ user_id: string; status: string }>();
  if (!row) throw new HttpError(404, "订单不存在。");
  if (!["pending", "paid"].includes(row.status))
    throw new HttpError(409, "此订单状态不需要核对。");
  const result = await recoverBilling(row.user_id, p.data.id);
  await db
    .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
    .bind(
      crypto.randomUUID(),
      admin.id,
      `order.reconciled:${result.failed ? "failed" : result.needsSupport ? "needs_support" : "checked"}`,
      p.data.id,
      Date.now(),
    )
    .run();
  return result;
}
