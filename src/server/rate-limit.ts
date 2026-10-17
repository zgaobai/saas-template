import "@tanstack/react-start/server-only";
import { bindings } from "./env";
import { HttpError } from "./http";

// Shared D1 counters work across Worker isolates; no in-memory per-process limiter.
export async function limitRequest(
  userId: string,
  action: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
  const key = action + ":" + userId;
  const result = await bindings()
    .DB.prepare(
      `INSERT INTO request_limits (key,count,reset_at) VALUES (?,1,?)
     ON CONFLICT(key) DO UPDATE SET
       count=CASE WHEN request_limits.reset_at<=? THEN 1 ELSE request_limits.count+1 END,
       reset_at=CASE WHEN request_limits.reset_at<=? THEN excluded.reset_at ELSE request_limits.reset_at END
     WHERE request_limits.reset_at<=? OR request_limits.count<?
     RETURNING count`,
    )
    .bind(key, resetAt, now, now, now, limit)
    .first<{ count: number }>();
  if (!result)
    throw new HttpError(
      429,
      "操作太频繁，请稍后再试。",
      Math.max(1, Math.ceil((resetAt - now) / 1000)),
    );
}
