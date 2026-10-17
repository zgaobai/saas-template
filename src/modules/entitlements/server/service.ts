import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
export async function currentEntitlement(userId: string) {
  return bindings()
    .DB.prepare(
      "SELECT plan_id,plan_name,status,paid_until FROM (SELECT s.plan_id,o.plan_name,s.status,s.paid_until FROM subscriptions s JOIN orders o ON o.id=s.order_id WHERE s.user_id=? AND s.paid_until>? UNION ALL SELECT plan_id,plan_name,'REDEEMED' AS status,expires_at AS paid_until FROM redemptions WHERE user_id=? AND expires_at>?) ORDER BY paid_until DESC LIMIT 1",
    )
    .bind(userId, Date.now(), userId, Date.now())
    .first<{
      plan_id: string;
      plan_name: string;
      status: string;
      paid_until: number;
    }>();
}
