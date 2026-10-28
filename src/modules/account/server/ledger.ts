import "@tanstack/react-start/server-only";
import { z } from "zod";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";
import { balance } from "@/modules/credits/server/service";
export async function personalLedger(request: Request, userId: string) {
  const p = z
    .object({
      kind: z
        .enum([
          "",
          "spent",
          "returned",
          "earned",
          "payment",
          "subscription",
          "redeem",
        ])
        .default(""),
      cursor: z.string().max(1000).optional(),
      days: z.enum(["7", "30", "90"]).default("30"),
    })
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!p.success) throw new HttpError(400, "查询条件无效。");
  const q = p.data,
    where = ["user_id=?"],
    values: (string | number)[] = [userId];
  if (q.kind === "spent") where.push("id LIKE 'generation:%'");
  if (q.kind === "returned") where.push("id LIKE 'release:%'");
  if (q.kind === "payment") where.push("id LIKE 'payment:%'");
  if (q.kind === "subscription")
    where.push("(id LIKE 'redeem-month:%' OR id LIKE 'installment:%')");
  if (q.kind === "redeem")
    where.push("id LIKE 'redeem:%' AND id NOT LIKE 'redeem-month:%'");
  if (q.kind === "earned") where.push("amount>0 AND id NOT LIKE 'release:%'");
  if (q.cursor) {
    try {
      const c = z
        .object({
          time: z.number().int().nonnegative(),
          id: z.string().min(1).max(256),
        })
        .strict()
        .parse(JSON.parse(Buffer.from(q.cursor, "base64url").toString()));
      where.push("(created_at,id)<(?,?)");
      values.push(c.time, c.id);
    } catch {
      throw new HttpError(400, "分页信息无效。");
    }
  }
  const db = bindings().DB,
    now = Date.now();
  const [credits, rows, summary] = await Promise.all([
    balance(userId),
    db
      .prepare(
        `SELECT id,amount,reason,created_at FROM credit_ledger WHERE ${where.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT 26`,
      )
      .bind(...values)
      .all<{
        id: string;
        amount: number;
        reason: string;
        created_at: number;
      }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN id LIKE 'generation:%' THEN -amount ELSE 0 END),0) AS spent,COALESCE(SUM(CASE WHEN id LIKE 'release:%' THEN amount ELSE 0 END),0) AS returned,COALESCE(SUM(CASE WHEN amount>0 AND id NOT LIKE 'release:%' THEN amount ELSE 0 END),0) AS earned FROM credit_ledger WHERE user_id=? AND created_at>=? AND created_at<=?",
      )
      .bind(userId, now - Number(q.days) * 86400000, now)
      .first(),
  ]);
  const items = rows.results.slice(0, 25),
    last = items.at(-1);
  return {
    balance: credits,
    summary,
    items,
    nextCursor:
      rows.results.length > 25 && last
        ? Buffer.from(
            JSON.stringify({ time: last.created_at, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
