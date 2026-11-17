import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { getPlan } from "@/modules/billing/server/plans";

export function getStartOfDayUtc8(now = Date.now()): number {
  const offset = 8 * 60 * 60 * 1000;
  const localDate = new Date(now + offset);
  localDate.setUTCHours(0, 0, 0, 0);
  return localDate.getTime() - offset;
}

export interface FreeQuotaStatus {
  enabled: boolean;
  dailyLimit: number;
  todayGranted: number;
  remainingToday: number;
  isCappedToday: boolean;
  todayStart: number;
}

export async function getFreeQuotaStatus(
  now = Date.now(),
): Promise<FreeQuotaStatus> {
  const db = bindings().DB;
  const todayStart = getStartOfDayUtc8(now);

  let enabled = true;
  let dailyLimit = 100;

  if (!db) {
    return {
      enabled,
      dailyLimit,
      todayGranted: 0,
      remainingToday: dailyLimit,
      isCappedToday: false,
      todayStart,
    };
  }

  try {
    const rows = await db
      .prepare(
        "SELECT key, value FROM system_settings WHERE key IN ('free_quota_enabled', 'free_quota_daily_limit')",
      )
      .all<{ key: string; value: string }>();

    for (const r of rows.results || []) {
      if (r.key === "free_quota_enabled") {
        enabled = r.value !== "false";
      } else if (r.key === "free_quota_daily_limit") {
        const parsed = parseInt(r.value, 10);
        if (!isNaN(parsed) && parsed >= 0) dailyLimit = parsed;
      }
    }
  } catch {
    // system_settings table might be missing in early migrations
  }

  let todayGranted = 0;
  try {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM credit_ledger WHERE id LIKE 'welcome:%' AND amount > 0 AND created_at >= ?",
      )
      .bind(todayStart)
      .first<{ count: number }>();
    todayGranted = row?.count ?? 0;
  } catch {
    todayGranted = 0;
  }

  const remainingToday = Math.max(0, dailyLimit - todayGranted);
  const isCappedToday = todayGranted >= dailyLimit;

  return {
    enabled,
    dailyLimit,
    todayGranted,
    remainingToday,
    isCappedToday,
    todayStart,
  };
}

export async function setFreeQuotaConfig(
  config: { enabled?: boolean; dailyLimit?: number },
  userId?: string,
): Promise<void> {
  const db = bindings().DB;
  if (!db) return;

  const now = Date.now();
  const statements = [];

  if (config.enabled !== undefined) {
    statements.push(
      db
        .prepare(
          "INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES ('free_quota_enabled', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
        )
        .bind(config.enabled ? "true" : "false", now, userId ?? null),
    );
  }

  if (config.dailyLimit !== undefined && config.dailyLimit >= 0) {
    statements.push(
      db
        .prepare(
          "INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES ('free_quota_daily_limit', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
        )
        .bind(String(Math.floor(config.dailyLimit)), now, userId ?? null),
    );
  }

  if (userId) {
    try {
      const action =
        config.enabled !== undefined
          ? config.enabled
            ? "free_quota.enabled"
            : "free_quota.disabled"
          : "free_quota.limit_updated";
      statements.push(
        db
          .prepare(
            "INSERT INTO audit_logs (id, actor_id, action, target_id, created_at) VALUES (?, ?, ?, 'system', ?)",
          )
          .bind(crypto.randomUUID(), userId, action, now),
      );
    } catch {}
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }
}

export async function ensureWallet(userId: string) {
  const db = bindings().DB;
  if (!db || !userId) return;

  // Check if this user's welcome ledger record already exists
  const existing = await db
    .prepare("SELECT 1 FROM credit_ledger WHERE id=?")
    .bind(`welcome:${userId}`)
    .first();

  if (existing) {
    await db
      .prepare("INSERT OR IGNORE INTO wallets (user_id,balance) VALUES (?,0)")
      .bind(userId)
      .run();
    return;
  }

  const starter = await getPlan("starter");
  const quota = await getFreeQuotaStatus();

  // If free quota is enabled, not capped today, and starter plan enabled, grant credits
  const shouldGrant =
    starter.enabled && quota.enabled && !quota.isCappedToday;
  const credits = shouldGrant ? starter.credits : 0;
  const reason = shouldGrant
    ? "注册赠送"
    : quota.isCappedToday
      ? "注册赠送(今日上限)"
      : "注册赠送(暂停)";

  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO wallets (user_id,balance) VALUES (?,0)")
      .bind(userId),
    db
      .prepare(
        "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,?,?,?)",
      )
      .bind(`welcome:${userId}`, userId, credits, reason, Date.now()),
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
