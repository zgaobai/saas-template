import { planOffer } from "@/modules/billing/server/plan-contract";
import "@tanstack/react-start/server-only";
import { generateCode, encryptCode } from "./code-vault";
import { shortId } from "@/server/id";
import { createHash } from "node:crypto";
import { z } from "zod";
import { bindings } from "@/server/env";
import { body, HttpError } from "@/server/http";
import { requireAdmin } from "@/modules/auth/server/session";
import { getPlan } from "@/modules/billing/server/plans";
import { ensureWallet } from "@/modules/credits/server/service";
export const codeHash = (code: string) =>
  createHash("sha256")
    .update(code.replace(/[\s-]/g, "").toUpperCase())
    .digest("hex");
export async function createCode(request: Request) {
  const admin = await requireAdmin(request);
  const parsed = z
    .object({
      requestId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      kind: z.enum(["credits", "plan"]),
      credits: z.number().int().min(1).max(1000000),
      planId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,64}$/)
        .optional(),
      interval: z.enum(["month", "year"]).optional(),
      maxUses: z.literal(1).default(1),
      expiresAt: z.number().int().positive(),
    })
    .strict()
    .safeParse(await body(request));
  if (!parsed.success)
    throw new HttpError(400, "请输入有效的兑换码奖励、人数和有效期。");
  const d = parsed.data,
    now = Date.now();
  if (d.expiresAt <= now || d.expiresAt > now + 366 * 86400000)
    throw new HttpError(400, "兑换有效期应在未来一年内。");
  const plan = d.kind === "plan" ? await getPlan(d.planId || "") : null;
  if (plan && (!plan.enabled || plan.mode === "free"))
    throw new HttpError(400, "不能为已下架套餐创建兑换码。");
  if (plan?.interval === "year")
    throw new HttpError(400, "独立年付套餐已停用，请选择订阅套餐的年付权益。");
  const db = bindings().DB;
  if (
    await db
      .prepare("SELECT id FROM redeem_codes WHERE id=?")
      .bind(d.requestId)
      .first()
  )
    throw new HttpError(409, "该请求已创建兑换码，请在兑换码列表查看和复制。");
  let interval: "month" | "year" | null | undefined = plan?.interval;
  if (plan) {
    try {
      interval = planOffer(plan, d.interval).interval;
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "请选择计费方式。",
      );
    }
  }
  const credits = plan?.credits ?? d.credits,
    grantMonths = interval === "year" ? 12 : 1,
    termMonths = plan?.mode === "subscription" ? grantMonths : 0;
  if (credits < 1) throw new HttpError(400, "奖励积分必须大于零。");
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const hash = codeHash(code);
    if (
      await db
        .prepare("SELECT id FROM redeem_codes WHERE code_hash=?")
        .bind(hash)
        .first()
    )
      continue;
    const encrypted = encryptCode(code, d.requestId);
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO redeem_codes(id,code_hash,code_ciphertext,hint,name,kind,plan_id,plan_name,credits,term_months,grant_months,max_uses,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            d.requestId,
            hash,
            encrypted,
            code.slice(0, 2) + "…" + code.slice(-2),
            d.name,
            d.kind,
            plan?.id ?? null,
            plan?.name ?? null,
            credits,
            termMonths,
            grantMonths,
            d.maxUses,
            d.expiresAt,
            now,
          ),
        db
          .prepare(
            "INSERT INTO audit_logs(id,actor_id,action,target_id,created_at) VALUES (?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            admin.id,
            "code.created",
            d.requestId,
            now,
          ),
      ]);
      return {
        id: d.requestId,
        code,
        credits,
        termMonths,
        grantMonths,
        planName: plan?.name ?? null,
      };
    } catch (error) {
      if (
        !(await db
          .prepare("SELECT id FROM redeem_codes WHERE code_hash=?")
          .bind(hash)
          .first())
      )
        throw error;
    }
  }
  throw new HttpError(503, "暂时无法生成兑换码，请重试。");
}
export async function setCodeStatus(request: Request) {
  const admin = await requireAdmin(request);
  const p = z
    .object({ id: z.string().uuid(), disabled: z.boolean() })
    .strict()
    .safeParse(await body(request));
  if (!p.success) throw new HttpError(400, "兑换码参数不正确。");
  const db = bindings().DB,
    now = Date.now();
  const current = await db
    .prepare("SELECT id,used FROM redeem_codes WHERE id=?")
    .bind(p.data.id)
    .first<{ id: string; used: number }>();
  if (!current) throw new HttpError(404, "兑换码不存在。");
  if (current.used > 0)
    throw new HttpError(409, "兑换码已兑换，不能再次启用或修改。");
  await db.batch([
    db
      .prepare("UPDATE redeem_codes SET disabled_at=? WHERE id=?")
      .bind(p.data.disabled ? now : null, p.data.id),
    db
      .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        admin.id,
        p.data.disabled ? "code.disabled" : "code.enabled",
        p.data.id,
        now,
      ),
  ]);
  return { ok: true };
}
export type Redemption = {
  id: string;
  code_id: string;
  grant_months: number;
  starts_at: number;
  credits: number;
  plan_id: string | null;
  plan_name: string | null;
  expires_at: number;
  created_at: number;
};
export async function redeem(request: Request, userId: string) {
  const p = z
    .object({ code: z.string().trim().min(6).max(90) })
    .strict()
    .safeParse(await body(request, 1024));
  if (!p.success) throw new HttpError(400, "请输入完整兑换码。");
  const db = bindings().DB;
  const c = await db
    .prepare("SELECT id FROM redeem_codes WHERE code_hash=?")
    .bind(codeHash(p.data.code))
    .first<{ id: string }>();
  if (!c) throw new HttpError(400, "兑换码无效、已兑换、停用或过期。");
  const lookup = () =>
    db
      .prepare(
        "SELECT id,code_id,credits,grant_months,starts_at,plan_id,plan_name,expires_at,created_at FROM redemptions WHERE code_id=? AND user_id=?",
      )
      .bind(c.id, userId)
      .first<Redemption>();
  const old = await lookup();
  if (old) return { ...old, alreadyRedeemed: true };
  await ensureWallet(userId);
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO redemptions(id,code_id,user_id,credits,plan_id,plan_name,expires_at,created_at,grant_months,starts_at)
 SELECT ?,id,?,credits,plan_id,plan_name,CASE WHEN days>0 THEN start+days*86400000 ELSE 0 END,?,grant_months,start
 FROM (SELECT c.*,MAX(?,COALESCE((SELECT MAX(expires_at) FROM redemptions WHERE user_id=? AND plan_id=c.plan_id),0),COALESCE((SELECT MAX(paid_until) FROM subscriptions WHERE user_id=? AND plan_id=c.plan_id),0)) AS start FROM redeem_codes c WHERE c.id=?)`,
      )
      .bind(shortId(), userId, now, now, userId, userId, c.id)
      .run();
  } catch {
    const existing = await lookup();
    if (existing) return { ...existing, alreadyRedeemed: true };
    throw new HttpError(409, "兑换码无效、已兑换、停用或过期。");
  }
  const result = await lookup();
  if (!result) throw new HttpError(409, "未能完成兑换，请重试。");
  return { ...result, alreadyRedeemed: false };
}
