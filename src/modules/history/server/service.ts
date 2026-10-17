import "@tanstack/react-start/server-only";
import { z } from "zod";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";
import type { Generation } from "@/modules/tools/types";
const cursorSchema = z
  .object({
    time: z.number().int().nonnegative(),
    id: z.string().min(1).max(128),
  })
  .strict();
export async function listHistory(request: Request, userId: string) {
  const url = new URL(request.url);
  const input = z
    .object({
      cursor: z.string().max(600).optional(),
      status: z
        .enum(["", "pending", "completed", "failed", "blocked"])
        .default(""),
      search: z.string().trim().max(100).default(""),
    })
    .safeParse(Object.fromEntries(url.searchParams));
  if (!input.success) throw new HttpError(400, "查询条件不正确。");
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (input.data.cursor)
    try {
      cursor = cursorSchema.parse(
        JSON.parse(
          Buffer.from(input.data.cursor, "base64url").toString("utf8"),
        ),
      );
    } catch {
      throw new HttpError(400, "分页信息无效，请刷新。");
    }
  const pattern = "%" + input.data.search.replace(/[\\%_]/g, "\\$&") + "%";
  const rows = await bindings()
    .DB.prepare(
      "SELECT id,prompt,tone,tool_id,output,status,cost,completed_at,error_code,created_at,(SELECT COALESCE(SUM(amount),0) FROM credit_ledger WHERE id='release:'||generations.id) AS refunded FROM generations WHERE user_id=? AND (?='' OR status=?) AND prompt LIKE ? ESCAPE '\\' AND (? IS NULL OR created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 21",
    )
    .bind(
      userId,
      input.data.status,
      input.data.status,
      pattern,
      cursor?.time ?? null,
      cursor?.time ?? 0,
      cursor?.time ?? 0,
      cursor?.id ?? "",
    )
    .all<Generation>();
  const history = rows.results.slice(0, 20);
  const last = history.at(-1);
  return {
    history,
    nextCursor:
      rows.results.length > 20 && last
        ? Buffer.from(
            JSON.stringify({ time: last.created_at, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
export async function deleteHistory(id: string, userId: string) {
  if (!id || id.length > 128) throw new HttpError(400, "记录信息不正确。");
  const row = await bindings()
    .DB.prepare("SELECT status FROM generations WHERE id=? AND user_id=?")
    .bind(id, userId)
    .first<{ status: string }>();
  if (!row) throw new HttpError(404, "记录不存在。");
  if (row.status === "pending")
    throw new HttpError(409, "生成中的记录暂不能删除。");
  await bindings()
    .DB.prepare(
      "DELETE FROM generations WHERE id=? AND user_id=? AND status<>'pending'",
    )
    .bind(id, userId)
    .run();
  return { ok: true };
}
