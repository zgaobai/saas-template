import "@tanstack/react-start/server-only";
import { z } from "zod";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";

const sections = {
  orders: {
    select:
      "SELECT id,plan_id,plan_name,checkout_url,amount,currency,status,created_at FROM orders",
    owner: "user_id",
    time: "created_at",
    id: "id",
  },
  subscriptions: {
    select:
      "SELECT s.id,s.plan_id,o.plan_name,s.status,s.paid_until,s.updated_at FROM subscriptions s JOIN orders o ON o.id=s.order_id AND o.user_id=s.user_id",
    owner: "s.user_id",
    time: "s.updated_at",
    id: "s.id",
  },
  redemptions: {
    select:
      "SELECT id,credits,grant_months,starts_at,plan_id,plan_name,expires_at,created_at FROM redemptions",
    owner: "user_id",
    time: "created_at",
    id: "id",
  },
} as const;
export async function personalBillingRecords(
  request: Request,
  userId: string,
): Promise<
  Record<
    keyof typeof sections,
    { id: string; created_at?: number; updated_at?: number }[]
  > & { nextCursor: string | null }
> {
  const input = z
    .object({
      section: z.enum(["orders", "subscriptions", "redemptions"]),
      cursor: z.string().max(1000).optional(),
    })
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!input.success) throw new HttpError(400, "查询条件无效。");
  const { section } = input.data;
  const config = sections[section];
  const values: (string | number)[] = [userId];
  let where = `${config.owner}=?`;
  if (input.data.cursor) {
    try {
      const cursor = z
        .object({
          section: z.literal(section),
          time: z.number().int().nonnegative(),
          id: z.string().min(1).max(256),
        })
        .strict()
        .parse(
          JSON.parse(
            Buffer.from(input.data.cursor, "base64url").toString("utf8"),
          ),
        );
      where += ` AND (${config.time},${config.id}) < (?,?)`;
      values.push(cursor.time, cursor.id);
    } catch {
      throw new HttpError(400, "分页信息无效，请重新查询。");
    }
  }
  const { results } = await bindings()
    .DB.prepare(
      `${config.select} WHERE ${where} ORDER BY ${config.time} DESC,${config.id} DESC LIMIT 26`,
    )
    .bind(...values)
    .all<{ id: string; created_at?: number; updated_at?: number }>();
  const items = results.slice(0, 25);
  const last = items.at(-1);
  return {
    orders: [],
    subscriptions: [],
    redemptions: [],
    [section]: items,
    nextCursor:
      results.length > 25 && last
        ? Buffer.from(
            JSON.stringify({
              section,
              time:
                section === "subscriptions" ? last.updated_at : last.created_at,
              id: last.id,
            }),
          ).toString("base64url")
        : null,
  };
}
