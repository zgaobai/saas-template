import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { requireAdmin } from "@/modules/auth/server/session";
import { auth } from "@/modules/auth/server/auth";
import { body, HttpError } from "@/server/http";
import { limitRequest } from "@/server/rate-limit";
import { z } from "zod";
import type { FeedbackItem } from "../types";

export type { FeedbackItem };

const submitFeedbackSchema = z.object({
  type: z.enum(["suggestion", "bug", "billing", "other"]).default("suggestion"),
  title: z.string().trim().min(2, "请输入反馈标题").max(100, "标题不能超过 100 字"),
  content: z.string().trim().min(5, "请详细描述你的建议或遇到的问题").max(2000, "内容不能超过 2000 字"),
  contact: z.string().trim().max(100).default(""),
});

export async function submitFeedback(request: Request): Promise<{ ok: boolean; id: string }> {
  const session = await auth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id || null;
  const userEmail = session?.user?.email || "";

  // Rate limiting: 5 feedback submissions per hour per user/IP
  const clientIp = request.headers.get("cf-connecting-ip") || "anonymous";
  const limitKey = userId ? `feedback:${userId}` : `feedback-ip:${clientIp}`;
  await limitRequest(limitKey, "feedback", 5, 3600000);

  const parsed = submitFeedbackSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message || "参数错误");
  }

  const d = parsed.data;
  const db = bindings().DB;
  const id = crypto.randomUUID();
  const now = Date.now();
  const finalEmail = userEmail || d.contact || "匿名用户";

  await db
    .prepare(
      `INSERT INTO feedbacks (id, user_id, user_email, type, title, content, contact, status, admin_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)`,
    )
    .bind(id, userId, finalEmail, d.type, d.title, d.content, d.contact, now, now)
    .run();

  return { ok: true, id };
}

export async function listAdminFeedbacks(
  request: Request,
): Promise<{ items: FeedbackItem[]; nextCursor: string | null }> {
  await requireAdmin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const type = url.searchParams.get("type") || "";
  const cursorParam = url.searchParams.get("cursor");

  const db = bindings().DB;
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (status && status !== "all") {
    conditions.push("status = ?");
    values.push(status);
  }
  if (type && type !== "all") {
    conditions.push("type = ?");
    values.push(type);
  }

  if (cursorParam) {
    try {
      const decoded = JSON.parse(Buffer.from(cursorParam, "base64url").toString("utf8")) as {
        time: number;
        id: string;
      };
      conditions.push("(created_at, id) < (?, ?)");
      values.push(decoded.time, decoded.id);
    } catch {}
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, user_id, user_email, type, title, content, contact, status, admin_notes, created_at, updated_at
               FROM feedbacks ${whereClause}
               ORDER BY created_at DESC, id DESC LIMIT 26`;

  const rows = (await db.prepare(sql).bind(...values).all<FeedbackItem>()).results;
  const items = rows.slice(0, 25);
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      rows.length > 25 && last
        ? Buffer.from(JSON.stringify({ time: last.created_at, id: last.id })).toString("base64url")
        : null,
  };
}

export async function updateFeedbackStatus(request: Request): Promise<{ ok: boolean }> {
  const admin = await requireAdmin(request);
  const parsed = z
    .object({
      id: z.string().min(1),
      status: z.enum(["pending", "in_progress", "resolved", "closed"]),
      adminNotes: z.string().max(500).default(""),
    })
    .safeParse(await body(request));

  if (!parsed.success) throw new HttpError(400, "参数错误");

  const { id, status, adminNotes } = parsed.data;
  const db = bindings().DB;
  const now = Date.now();

  await db
    .prepare("UPDATE feedbacks SET status=?, admin_notes=?, updated_at=? WHERE id=?")
    .bind(status, adminNotes, now, id)
    .run();

  await db
    .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), admin.id, `feedback.status:${status}`, id, now);

  return { ok: true };
}
