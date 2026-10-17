import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";

/** Each date is anchored to the original billing day, clamping month-end safely. */
export function monthlyDate(start: number, offset: number) {
  const anchor = new Date(start);
  const date = new Date(start);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(anchor.getUTCDate(), last));
  return date.getTime();
}
export function installmentStatements(
  receiptId: string,
  userId: string,
  credits: number,
  start: number,
  end: number,
  now: number,
) {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    end <= start ||
    end - start < 360 * 86400000 ||
    end - start > 367 * 86400000
  )
    throw new Error("Await confirmed annual payment period");
  const db = bindings().DB;
  return Array.from({ length: 12 }, (_, index) =>
    db
      .prepare(
        "INSERT OR IGNORE INTO credit_installments(id,receipt_id,user_id,installment,credits,due_at) SELECT ?,id,user_id,?,?,? FROM receipts WHERE id=? AND user_id=? AND refunded<amount",
      )
      .bind(
        `${receiptId}:${index + 1}`,
        index + 1,
        credits,
        monthlyDate(start, index),
        receiptId,
        userId,
      ),
  ).concat([
    db
      .prepare(
        "UPDATE credit_installments SET granted_at=? WHERE receipt_id=? AND due_at<=? AND granted_at IS NULL AND canceled_at IS NULL AND EXISTS(SELECT 1 FROM receipts r JOIN user u ON u.id=r.user_id WHERE r.id=receipt_id AND r.refunded<r.amount AND u.closed_at IS NULL)",
      )
      .bind(now, receiptId, now),
  ]);
}
export async function grantDueInstallments(now = Date.now()) {
  const db = bindings().DB;
  // One bounded write; the trigger grants ledger credit and marks the installment atomically.
  const result = await db
    .prepare(
      `UPDATE credit_installments SET granted_at=? WHERE id IN (
    SELECT i.id FROM credit_installments i JOIN receipts r ON r.id=i.receipt_id JOIN user u ON u.id=i.user_id
    WHERE i.granted_at IS NULL AND i.canceled_at IS NULL AND i.due_at<=? AND r.refunded<r.amount AND u.closed_at IS NULL
    ORDER BY i.due_at,i.id LIMIT 100
  ) AND granted_at IS NULL AND canceled_at IS NULL`,
    )
    .bind(now, now)
    .run();
  const redemptionResult = await db
    .prepare(
      `UPDATE redemption_installments SET granted_at=? WHERE id IN (
 SELECT i.id FROM redemption_installments i JOIN user u ON u.id=i.user_id
 WHERE i.granted_at IS NULL AND i.due_at<=? AND u.closed_at IS NULL
 ORDER BY i.due_at,i.id LIMIT 100
 ) AND granted_at IS NULL`,
    )
    .bind(now, now)
    .run();
  return (result.meta?.changes ?? 0) + (redemptionResult.meta?.changes ?? 0);
}

export async function nextCreditGrant(userId: string) {
  const db = bindings().DB;
  const rows = await Promise.all([
    db
      .prepare(
        `SELECT i.due_at,i.credits-(CAST((r.credits+i.credits)*r.refunded/r.amount AS INTEGER)-r.revoked) AS credits,i.installment,o.plan_name FROM credit_installments i JOIN receipts r ON r.id=i.receipt_id JOIN orders o ON o.id=r.order_id JOIN user u ON u.id=i.user_id WHERE i.user_id=? AND i.granted_at IS NULL AND i.canceled_at IS NULL AND r.refunded<r.amount AND u.closed_at IS NULL ORDER BY i.due_at LIMIT 1`,
      )
      .bind(userId)
      .first<{
        due_at: number;
        credits: number;
        installment: number;
        plan_name: string;
      }>(),
    db
      .prepare(
        `SELECT i.due_at,i.credits,i.installment,r.plan_name FROM redemption_installments i JOIN redemptions r ON r.id=i.redemption_id JOIN user u ON u.id=i.user_id WHERE i.user_id=? AND i.granted_at IS NULL AND u.closed_at IS NULL ORDER BY i.due_at LIMIT 1`,
      )
      .bind(userId)
      .first<{
        due_at: number;
        credits: number;
        installment: number;
        plan_name: string;
      }>(),
  ]);
  return (
    rows.filter((r) => r !== null).sort((a, b) => a.due_at - b.due_at)[0] ??
    null
  );
}
