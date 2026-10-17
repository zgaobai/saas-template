import "@tanstack/react-start/server-only";
import { grantDueInstallments } from "@/modules/billing/server/installments";
import { bindings } from "./env";
import { recoverStale } from "@/modules/tools/server/generation";
export function runScheduledMaintenance(cron: string) {
  return runMaintenance(cron === "0 0 * * *" ? "credits" : "routine");
}
export async function runMaintenance(job: "routine" | "credits" = "routine") {
  const db = bindings().DB;
  const now = Date.now(),
    token = crypto.randomUUID();
  const lease = await db
    .prepare(
      `INSERT INTO maintenance_state(id,lease_token,lease_until,started_at,status) VALUES (?,?,?,?,'running')
    ON CONFLICT(id) DO UPDATE SET lease_token=excluded.lease_token,lease_until=excluded.lease_until,started_at=excluded.started_at,status='running'
    WHERE maintenance_state.lease_until<? RETURNING id`,
    )
    .bind(job, token, now + 1200000, now, now)
    .first();
  if (!lease) return { skipped: true };
  try {
    const results = await Promise.allSettled(
      job === "credits"
        ? [grantDueInstallments(now)]
        : [
            recoverStale(undefined, 100),
            db.batch([
              db.prepare("DELETE FROM session WHERE expires_at<?").bind(now),
              db
                .prepare("DELETE FROM verification WHERE expires_at<?")
                .bind(now),
              db
                .prepare("DELETE FROM request_limits WHERE reset_at<?")
                .bind(now - 86400000),
              db
                .prepare("DELETE FROM rate_limit WHERE last_request<?")
                .bind(now - 86400000),
            ]),
          ],
    );
    const failed = results.some((r) => r.status === "rejected");
    await db
      .prepare(
        "UPDATE maintenance_state SET lease_token=NULL,lease_until=0,completed_at=?,status=? WHERE id=? AND lease_token=?",
      )
      .bind(Date.now(), failed ? "failed" : "completed", job, token)
      .run();
    // Log bounded counts only; never raw exceptions, user content, or bindings.
    console.info(
      JSON.stringify({
        event: "maintenance",
        job,
        status: failed ? "failed" : "completed",
      }),
    );
    if (failed) throw new Error("Maintenance incomplete");
    return { skipped: false, status: "completed" };
  } catch {
    await db
      .prepare(
        "UPDATE maintenance_state SET lease_token=NULL,lease_until=0,status='failed' WHERE id=? AND lease_token=?",
      )
      .bind(job, token)
      .run();
    throw new Error("Maintenance incomplete");
  }
}
