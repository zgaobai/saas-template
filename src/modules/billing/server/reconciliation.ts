import "@tanstack/react-start/server-only";
import { installmentStatements } from "./installments";
import { orderMode } from "./plan-contract";
import { z } from "zod";
import { bindings } from "@/server/env";
import type { PaymentProviderId, Reconciliation } from "./providers/contract";

const identity = z.string().min(1).max(240);
const money = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const time = z.number().int().nonnegative().max(8640000000000000);
const reconciliation = z.object({
  payments: z
    .array(
      z.object({
        orderId: identity,
        userId: identity,
        paymentId: identity,
        amount: money,
        currency: z.string().length(3),
        subscriptionId: identity.optional(),
        coveredUntil: time.optional(),
        coveredFrom: time.optional(),
      }),
    )
    .default([]),
  subscriptions: z
    .array(
      z.object({
        orderId: identity,
        userId: identity,
        subscriptionId: identity,
        status: z.enum([
          "ACTIVE",
          "CANCELING",
          "AUTHORIZATION_REQUIRED",
          "IN_PROGRESS",
          "CANCELED",
          "EXPIRED",
          "PAST_DUE",
        ]),
        updatedAt: time,
      }),
    )
    .default([]),
  refunds: z
    .array(
      z.object({
        refundId: identity,
        paymentId: identity,
        amount: money,
        currency: z.string().length(3),
        cumulative: z.boolean().optional(),
      }),
    )
    .default([]),
  expiredOrderIds: z.array(identity).default([]),
});
type Order = {
  id: string;
  user_id: string;
  provider: string;
  amount: number;
  currency: string;
  credits: number;
  plan_id: string;
  payment_mode: string | null;
  billing_interval: string | null;
};
async function ownOrder(id: string, provider: string, userId?: string) {
  const order = await bindings()
    .DB.prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first<Order>();
  if (
    !order ||
    order.provider !== provider ||
    (userId && order.user_id !== userId)
  )
    throw new Error("Payment identity mismatch");
  return order;
}
export async function applyReconciliation(
  provider: PaymentProviderId,
  value: Reconciliation,
) {
  const events = reconciliation.parse(value);
  const db = bindings().DB;
  for (const s of events.subscriptions) {
    const order = await ownOrder(s.orderId, provider, s.userId);
    if (orderMode(order) !== "subscription")
      throw new Error("Unexpected subscription");
    const old = await db
      .prepare("SELECT provider_id FROM subscriptions WHERE id=?")
      .bind(order.id)
      .first<{ provider_id: string }>();
    if (old && old.provider_id !== s.subscriptionId)
      throw new Error("Subscription identity conflict");
    await db
      .prepare(
        `INSERT INTO subscriptions (id,user_id,order_id,provider_id,plan_id,status,paid_until,updated_at)
      VALUES (?,?,?,?,?,?,0,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at
      WHERE subscriptions.provider_id=excluded.provider_id AND excluded.updated_at>=subscriptions.updated_at`,
      )
      .bind(
        order.id,
        order.user_id,
        order.id,
        s.subscriptionId,
        order.plan_id,
        s.status,
        s.updatedAt,
      )
      .run();
  }
  for (const s of events.subscriptions) {
    if (["CANCELED", "EXPIRED"].includes(s.status)) {
      await db
        .prepare(
          "UPDATE orders SET status='expired' WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM subscriptions WHERE order_id=? AND status IN ('CANCELED','EXPIRED'))",
        )
        .bind(s.orderId, s.orderId)
        .run();
    }
  }
  for (const p of events.payments) {
    const order = await ownOrder(p.orderId, provider, p.userId);
    if (
      p.amount !== order.amount ||
      p.currency.toUpperCase() !== order.currency
    )
      throw new Error("Payment amount/currency mismatch");
    if ((orderMode(order) === "subscription") !== Boolean(p.subscriptionId))
      throw new Error("Payment mode mismatch");
    if (p.subscriptionId) {
      const sub = await db
        .prepare(
          "SELECT id FROM subscriptions WHERE order_id=? AND provider_id=?",
        )
        .bind(order.id, p.subscriptionId)
        .first();
      if (!sub) throw new Error("Await subscription reconciliation");
    }
    const receiptId = `${provider}:${p.paymentId}`;
    const old = await db
      .prepare("SELECT order_id,amount FROM receipts WHERE id=?")
      .bind(receiptId)
      .first<{ order_id: string; amount: number }>();
    if (old && (old.order_id !== order.id || old.amount !== p.amount))
      throw new Error("Receipt identity conflict");
    const now = Date.now();
    const annual =
      orderMode(order) === "subscription" && order.billing_interval === "year";
    const alreadyScheduled =
      annual && old
        ? await db
            .prepare(
              "SELECT id FROM credit_installments WHERE receipt_id=? LIMIT 1",
            )
            .bind(receiptId)
            .first()
        : null;
    const schedule =
      annual && !alreadyScheduled
        ? installmentStatements(
            receiptId,
            order.user_id,
            order.credits,
            p.coveredFrom!,
            p.coveredUntil!,
            now,
          )
        : [];
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO wallets (user_id,balance) VALUES (?,0)")
        .bind(order.user_id),
      db
        .prepare(
          "INSERT OR IGNORE INTO receipts (id,order_id,user_id,provider_id,amount,credits,covered_until,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          receiptId,
          order.id,
          order.user_id,
          receiptId,
          p.amount,
          annual ? 0 : order.credits,
          p.coveredUntil || 0,
          now,
        ),
      // Read from the immutable receipt so a collision cannot credit another owner.
      db
        .prepare(
          "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) SELECT ?,user_id,credits,'购买积分',? FROM receipts WHERE id=? AND order_id=? AND ?=0",
        )
        .bind(`payment:${receiptId}`, now, receiptId, order.id, annual ? 1 : 0),
      ...schedule,
      db
        .prepare(
          "UPDATE orders SET status='paid' WHERE id=? AND EXISTS(SELECT 1 FROM receipts WHERE id=? AND order_id=? AND refunded<amount)",
        )
        .bind(order.id, receiptId, order.id),
      db
        .prepare(
          "UPDATE subscriptions SET paid_until=COALESCE((SELECT MAX(covered_until) FROM receipts WHERE order_id=? AND refunded<amount),0) WHERE order_id=?",
        )
        .bind(order.id, order.id),
    ]);
  }
  for (const r of events.refunds) {
    const receiptId = `${provider}:${r.paymentId}`;
    const receipt = await db
      .prepare(
        "SELECT r.id,r.amount,o.currency FROM receipts r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND o.provider=?",
      )
      .bind(receiptId, provider)
      .first<{ id: string; amount: number; currency: string }>();
    if (!receipt) throw new Error("Await payment reconciliation");
    if (
      r.amount > receipt.amount ||
      r.currency.toUpperCase() !== receipt.currency
    )
      throw new Error("Refund amount/currency mismatch");
    const id = `refund:${provider}:${r.refundId}`;
    if (r.cumulative) {
      // Compute the delta inside SQLite, not from a stale JS read. Out-of-order totals cannot revoke twice.
      await db
        .prepare(
          "INSERT OR IGNORE INTO refund_events (id,receipt_id,amount,created_at) SELECT ?,id,?-refunded,? FROM receipts WHERE id=? AND refunded<?",
        )
        .bind(id, r.amount, Date.now(), receipt.id, r.amount)
        .run();
    } else {
      await db
        .prepare(
          "INSERT OR IGNORE INTO refund_events (id,receipt_id,amount,created_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM refund_events WHERE id=?)",
        )
        .bind(id, receipt.id, r.amount, Date.now(), id)
        .run();
    }
  }
  for (const orderId of events.expiredOrderIds) {
    await ownOrder(orderId, provider);
    await db
      .prepare(
        "UPDATE orders SET status='expired' WHERE id=? AND provider=? AND status='pending'",
      )
      .bind(orderId, provider)
      .run();
  }
}
