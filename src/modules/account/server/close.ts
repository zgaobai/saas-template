import { shortId } from "@/server/id";
import "@tanstack/react-start/server-only";
import { z } from "zod";
import { auth } from "@/modules/auth/server/auth";
import { bindings } from "@/server/env";
import { assertOrigin, body, HttpError } from "@/server/http";

const confirmationSchema = z
  .object({ confirmation: z.literal("DELETE"), email: z.email().max(254) })
  .strict();
const FRESH_SESSION_MS = 5 * 60 * 1000;

export async function closeAccount(request: Request, userId: string) {
  assertOrigin(request);
  const session = await auth().api.getSession({ headers: request.headers });
  if (!session || session.user.id !== userId)
    throw new HttpError(401, "登录已过期，请重新登录。");
  const now = Date.now();
  const age = now - new Date(session.session.createdAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > FRESH_SESSION_MS)
    throw new HttpError(
      403,
      "注销需要最近 5 分钟内的登录，请重新登录后再操作。",
    );
  const parsed = confirmationSchema.safeParse(await body(request, 1024));
  if (
    !parsed.success ||
    parsed.data.email.toLowerCase() !== session.user.email.toLowerCase()
  )
    throw new HttpError(400, "请填写当前账户邮箱，并输入 DELETE 确认注销。");

  const database = bindings().DB;
  // The update and every conditional cleanup share one atomic D1 batch. The
  // insert guards in the migration prevent new activity after the close wins.
  const closed = "EXISTS (SELECT 1 FROM user WHERE id=? AND closed_at=?)";
  await database.batch([
    database
      .prepare(
        `UPDATE user SET closed_at=?,name='已注销用户',email=?,email_verified=0,image=NULL,updated_at=?
      WHERE id=? AND closed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM files WHERE user_id=?)
      AND NOT EXISTS (SELECT 1 FROM generations WHERE user_id=? AND status='pending')
      AND NOT EXISTS (SELECT 1 FROM orders WHERE user_id=? AND status='pending')
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id=? AND (o.payment_mode='subscription' OR (o.payment_mode IS NULL AND o.plan_id='creator')) AND o.status NOT IN ('failed','expired') AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.order_id=o.id AND s.user_id=o.user_id))
      AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id=? AND UPPER(status) NOT IN ('CANCELED','MERCHANT_CANCELLED','USER_CANCELLED','CHANNEL_CANCELLED','CLOSE','EXPIRED'))`,
      )
      .bind(
        now,
        `closed-${shortId()}@deleted.invalid`,
        now,
        userId,
        userId,
        userId,
        userId,
        userId,
        userId,
      ),
    database
      .prepare(`DELETE FROM session WHERE user_id=? AND ${closed}`)
      .bind(userId, userId, now),
    database
      .prepare(`DELETE FROM account WHERE user_id=? AND ${closed}`)
      .bind(userId, userId, now),
    database
      .prepare(
        `DELETE FROM verification WHERE (value=? OR identifier=?) AND ${closed}`,
      )
      .bind(userId, session.user.email, userId, now),
    database
      .prepare(`DELETE FROM generations WHERE user_id=? AND ${closed}`)
      .bind(userId, userId, now),
    database
      .prepare(
        `INSERT INTO audit_logs (id,actor_id,action,target_id,created_at) SELECT ?,?,'account.closed',?,? WHERE ${closed}`,
      )
      .bind(crypto.randomUUID(), userId, userId, now, userId, now),
  ]);
  const result = await database
    .prepare("SELECT closed_at FROM user WHERE id=?")
    .bind(userId)
    .first<{ closed_at: number | null }>();
  if (result?.closed_at !== now)
    throw new HttpError(
      409,
      "请先删除个人文件、等待生成任务完成、处理待付款订单并取消所有自动续费订阅，再注销账户。",
    );
  return { ok: true };
}
