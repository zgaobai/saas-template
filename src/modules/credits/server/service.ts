import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { getPlan } from "@/modules/billing/server/plans";
export async function ensureWallet(userId: string) {
  const db = bindings().DB;
  const starter = await getPlan("starter");
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO wallets (user_id,balance) VALUES (?,0)")
      .bind(userId),
    db
      .prepare(
        "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,?,?,?)",
      )
      .bind(
        `welcome:${userId}`,
        userId,
        starter.enabled ? starter.credits : 0,
        "注册赠送",
        Date.now(),
      ),
  ]);
}
export async function balance(userId: string) {
  await ensureWallet(userId);
  return (
    (
      await bindings()
        .DB.prepare("SELECT balance FROM wallets WHERE user_id=?")
        .bind(userId)
        .first<{ balance: number }>()
    )?.balance ?? 0
  );
}
