import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";

export async function getSystemSetting(
  key: string,
  fallback = "",
): Promise<string> {
  try {
    const db = bindings().DB;
    if (!db) return fallback;
    const row = await db
      .prepare("SELECT value FROM system_settings WHERE key=?")
      .bind(key)
      .first<{ value: string }>();
    return row?.value ?? fallback;
  } catch {
    // Failsafe if table doesn't exist yet or in memory test
    return fallback;
  }
}

export async function setSystemSetting(
  key: string,
  value: string,
  userId?: string,
): Promise<void> {
  const db = bindings().DB;
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
    )
    .bind(key, value, now, userId ?? null)
    .run();
}

export async function isPaymentsActive(): Promise<boolean> {
  // 1. Check environment variable override
  const env = bindings() as unknown as Record<string, unknown>;
  if (env.PAYMENTS_PAUSED === "true" || env.PAYMENTS_ENABLED === "false") {
    return false;
  }
  // 2. Check database dynamic setting
  const setting = await getSystemSetting("payments_enabled", "true");
  return setting !== "false";
}

export async function setPaymentsActive(
  enabled: boolean,
  userId: string,
): Promise<void> {
  const db = bindings().DB;
  await setSystemSetting(
    "payments_enabled",
    enabled ? "true" : "false",
    userId,
  );
  try {
    await db
      .prepare(
        "INSERT INTO audit_logs (id, actor_id, action, target_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        userId,
        enabled ? "payments.resumed" : "payments.paused",
        "system",
        Date.now(),
      )
      .run();
  } catch {
    // Non-blocking audit log
  }
}
