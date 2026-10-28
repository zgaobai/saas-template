import "@tanstack/react-start/server-only";
import { z } from "zod";
import { bindings } from "@/server/env";
import { HttpError, body } from "@/server/http";
import type { CheckoutInput } from "./providers/contract";
import { applyReconciliation } from "./reconciliation";
import { orderMode, paymentReference, planOffer } from "./plan-contract";
import { getPlan } from "./plans";
import { paymentProvider } from "./providers/registry";
import { ensureWallet } from "@/modules/credits/server/service";
export async function checkout(
  request: Request,
  u: { id: string; email: string },
) {
  const parsed = z
    .object({
      planId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
      requestId: z.string().uuid(),
      interval: z.enum(["month", "year"]).optional(),
      planRevision: z.number().int().positive().optional(),
      provider: z.enum(["pancake", "stripe", "creem", "paypal"]).optional(),
    })
    .strict()
    .safeParse(await body(request));
  if (!parsed.success) throw new HttpError(400, "请选择有效套餐。");
  const plan = await getPlan(parsed.data.planId);
  if (plan.mode === "free") throw new HttpError(400, "请选择付费套餐。");
  const { isPaymentsActive } = await import(
    "@/modules/admin/server/system-settings"
  );
  if (!(await isPaymentsActive())) {
    throw new HttpError(503, "支付通道维护中，请稍后再试。");
  }
  const db = bindings().DB;
  const id = parsed.data.requestId.replaceAll("-", "");
  await ensureWallet(u.id);
  const existing = await db
    .prepare(
      "SELECT user_id,plan_id,checkout_url,status,provider,amount,credits,created_at,payment_mode,billing_interval,product_ref,plan_name FROM orders WHERE id=?",
    )
    .bind(id)
    .first<{
      payment_mode: string | null;
      billing_interval: "month" | "year" | null;
      product_ref: string | null;
      plan_name: string;
      created_at: number;
      provider: string;
      amount: number;
      credits: number;
      user_id: string;
      plan_id: string;
      checkout_url: string | null;
      status: string;
    }>();
  const provider = paymentProvider(
    existing?.provider || parsed.data.provider,
  );
  if (existing) {
    if (
      existing.user_id !== u.id ||
      existing.plan_id !== plan.id ||
      (parsed.data.interval &&
        parsed.data.interval !== existing.billing_interval)
    )
      throw new HttpError(409, "订单请求冲突，请刷新后重试。");
    if (existing.status !== "pending")
      throw new HttpError(409, "订单已处理，请查看账单或重新选择套餐。");
    if (existing.checkout_url) return { url: existing.checkout_url };
    // Creem and Pancake document tracking, not create idempotency.
    // For other providers, do not retry after their finite idempotency window.
    if (
      existing.provider === "creem" ||
      existing.provider === "pancake" ||
      Date.now() - existing.created_at > 3600000
    )
      throw new HttpError(
        409,
        "上一笔订单仍待确认，请联系站点支持核对后再试。",
      );
  }
  let offer: ReturnType<typeof planOffer> | undefined;
  if (!existing) {
    if (plan.interval === "year")
      throw new HttpError(
        409,
        "该独立年付套餐已停止销售，请选择订阅套餐的年付选项。",
      );
    try {
      offer = planOffer(plan, parsed.data.interval);
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "请选择计费方式。",
      );
    }
  }
  const checkoutInput: CheckoutInput = {
    orderId: id,
    planId: plan.id,
    amount: existing?.amount ?? offer!.price,
    credits: existing?.credits ?? plan.credits,
    userId: u.id,
    email: u.email,
    mode: existing
      ? orderMode(existing)
      : plan.mode === "subscription"
        ? "subscription"
        : "payment",
    interval: existing ? existing.billing_interval : offer!.interval,
    productRef: existing
      ? existing.product_ref
      : offer!.interval === "year" && plan.interval !== "year"
        ? offer!.paymentBindings[provider.id]
        : paymentReference(provider.id, plan.id, offer!.paymentBindings),
    name: existing?.plan_name || plan.name,
  };
  if (!existing) {
    if (
      parsed.data.planRevision !== undefined &&
      parsed.data.planRevision !== plan.revision
    )
      throw new HttpError(409, "套餐已更新，请刷新价格后重新购买。");
    if (!plan.enabled) throw new HttpError(409, "此套餐已下架，请重新选择。");
    const unfinished = await db
      .prepare(
        "SELECT checkout_url,billing_interval,provider FROM orders WHERE user_id=? AND plan_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1",
      )
      .bind(u.id, plan.id)
      .first<{
        checkout_url: string | null;
        billing_interval: string | null;
        provider: string | null;
      }>();
    if (
      unfinished &&
      (!unfinished.provider || unfinished.provider === provider.id)
    ) {
      if (unfinished.billing_interval !== checkoutInput.interval)
        throw new HttpError(
          409,
          "已有其他计费方式的待付款订单，请先在账户中处理。",
        );
      if (unfinished?.checkout_url) return { url: unfinished.checkout_url };
      if (unfinished)
        throw new HttpError(409, "上一笔订单仍待确认，请稍后查看账单。");
    }
    const pending = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE user_id=? AND created_at>?",
      )
      .bind(u.id, Date.now() - 3600000)
      .first<{ n: number }>();
    if ((pending?.n || 0) >= 10)
      throw new HttpError(429, "创建订单过于频繁，请稍后再试。");
    if (plan.mode === "subscription") {
      const active = await db
        .prepare(
          "SELECT id FROM subscriptions WHERE user_id=? AND status IN ('ACTIVE','CANCELING','AUTHORIZATION_REQUIRED','IN_PROGRESS','PAST_DUE') LIMIT 1",
        )
        .bind(u.id)
        .first();
      if (active)
        throw new HttpError(409, "已有订阅或待完成的订阅，请先在账单中处理。");
    }
    // Validation only reads provider configuration/products. A failed preflight must
    // not leave a pending local order that blocks the customer from retrying.
    if (
      provider.id !== "stripe" &&
      !(provider.id === "paypal" && checkoutInput.mode === "payment") &&
      !checkoutInput.productRef
    )
      throw new HttpError(
        503,
        "此套餐尚未绑定当前支付渠道的商品，请联系站点管理员。",
      );
    await provider.validateCheckout?.(checkoutInput);
    await db
      .prepare(
        "INSERT INTO orders (id,user_id,plan_id,provider,amount,currency,credits,status,created_at,plan_name,payment_mode,billing_interval,product_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        u.id,
        plan.id,
        provider.id,
        checkoutInput.amount,
        "USD",
        plan.credits,
        "pending",
        Date.now(),
        plan.name,
        checkoutInput.mode,
        checkoutInput.interval ?? null,
        checkoutInput.productRef ?? null,
      )
      .run();
  }
  // Retry with the same provider request ID after an unknown network result.
  const result = await provider.createCheckout(checkoutInput);
  const statements = [
    db
      .prepare("UPDATE orders SET provider_id=?,checkout_url=? WHERE id=?")
      .bind(result.providerId, result.url, id),
  ];
  if (checkoutInput.mode === "subscription" && result.subscriptionId)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO subscriptions (id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at) VALUES (?,?,?,?,?,?,0,?)",
        )
        .bind(
          id,
          u.id,
          id,
          result.subscriptionId,
          plan.id,
          "AUTHORIZATION_REQUIRED",
          0,
        ),
    );
  await db.batch(statements);
  return { url: result.url };
}
export async function cancelSubscription(request: Request, userId: string) {
  const input = z
    .object({ id: z.string().min(1).max(128) })
    .strict()
    .safeParse(await body(request));
  if (!input.success) throw new HttpError(400, "订阅信息不正确。");
  const sub = await bindings()
    .DB.prepare(
      "SELECT s.provider_id,o.provider FROM subscriptions s JOIN orders o ON o.id=s.order_id WHERE s.id=? AND s.user_id=?",
    )
    .bind(input.data.id, userId)
    .first<{ provider_id: string; provider: string }>();
  if (!sub) throw new HttpError(404, "未找到订阅。");
  const provider = paymentProvider(sub.provider);
  await provider.cancelSubscription(sub.provider_id);
  // Confirm canonical status; retain already-paid access until its expiry.
  if ("syncSubscription" in provider) {
    await applyReconciliation(
      provider.id,
      await provider.syncSubscription(sub.provider_id),
    );
  }
  return { ok: true };
}

/** Explicit, authenticated recovery; never accepts a provider/order identifier from a redirect. */
export async function recoverBilling(userId: string, orderId?: string) {
  const db = bindings().DB;
  const rows = await db
    .prepare(
      "SELECT id,user_id,provider,provider_id,plan_id,payment_mode,amount,currency FROM orders WHERE user_id=? AND status IN ('pending','paid') AND (? IS NULL OR id=?) ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 10",
    )
    .bind(userId, orderId ?? null, orderId ?? null)
    .all<{
      id: string;
      user_id: string;
      provider: string;
      provider_id: string | null;
      plan_id: string;
      payment_mode: string | null;
      amount: number;
      currency: string;
    }>();
  const report = { checked: 0, pending: 0, needsSupport: 0, failed: 0 };
  for (const row of rows.results) {
    if (!row.provider_id && row.provider !== "pancake") {
      // Creem has no documented lookup by request_id. Do not create a replacement
      // when the original create may have succeeded. The merchant must reconcile it.
      report.needsSupport++;
      continue;
    }
    try {
      const provider = paymentProvider(row.provider);
      const input = {
        providerId: row.provider_id || "",
        orderId: row.id,
        userId,
        amount: row.amount,
        currency: row.currency,
        mode: orderMode(row),
      };
      let url: string | null | undefined;
      let remoteId = row.provider_id;
      if ("syncCheckout" in provider) {
        const result = await provider.syncCheckout(input);
        // Scope all normalized changes to the selected owned order before committing.
        for (const p of result.reconciliation.payments || [])
          if (
            p.orderId !== row.id ||
            p.userId !== userId ||
            p.amount !== row.amount ||
            p.currency !== row.currency
          )
            throw new Error("Recovery payment mismatch");
        for (const s of result.reconciliation.subscriptions || [])
          if (s.orderId !== row.id || s.userId !== userId)
            throw new Error("Recovery subscription mismatch");
        for (const id of result.reconciliation.expiredOrderIds || [])
          if (id !== row.id) throw new Error("Recovery order mismatch");
        for (const refund of result.reconciliation.refunds || [])
          if (
            !result.reconciliation.payments?.some(
              (p) => p.paymentId === refund.paymentId,
            )
          )
            throw new Error("Recovery refund outside selected payment");
        await applyReconciliation(provider.id, result.reconciliation);
        url = result.url;
      }
      if (url !== undefined)
        await db
          .prepare(
            "UPDATE orders SET checkout_url=?,provider_id=? WHERE id=? AND user_id=?",
          )
          .bind(url, remoteId, row.id, userId)
          .run();
      const state = await db
        .prepare("SELECT status FROM orders WHERE id=? AND user_id=?")
        .bind(row.id, userId)
        .first<{ status: string }>();
      report.checked++;
      if (state?.status === "pending") report.pending++;
    } catch {
      // No raw provider errors or credentials in the API response. Another failed
      // inquiry is not proof of a failed payment: retain the order for safe recovery.
      report.failed++;
    }
  }
  return report;
}
