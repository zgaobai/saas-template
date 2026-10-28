import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { requireAdmin } from "@/modules/auth/server/session";
import { body, HttpError } from "@/server/http";
import { z } from "zod";
import type { AnnouncementItem } from "../types";

export type { AnnouncementItem };

export async function getActiveAnnouncement(): Promise<AnnouncementItem | null> {
  const db = bindings().DB;
  const row = await db
    .prepare(
      "SELECT id,title,content,type,link_url,link_text,is_active,dismissible,created_at,updated_at FROM announcements WHERE is_active=1 ORDER BY created_at DESC LIMIT 1",
    )
    .first<AnnouncementItem>();
  return row || null;
}

export async function listAdminAnnouncements(request: Request): Promise<{ announcements: AnnouncementItem[] }> {
  await requireAdmin(request);
  const db = bindings().DB;
  const rows = await db
    .prepare(
      "SELECT id,title,content,type,link_url,link_text,is_active,dismissible,created_at,updated_at FROM announcements ORDER BY created_at DESC LIMIT 50",
    )
    .all<AnnouncementItem>();
  return { announcements: rows.results };
}

const announcementSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "请输入公告标题").max(100, "标题不能超过 100 字"),
  content: z.string().trim().min(1, "请输入公告内容").max(500, "内容不能超过 500 字"),
  type: z.enum(["info", "promotion", "warning"]).default("info"),
  linkUrl: z.string().trim().max(500).default(""),
  linkText: z.string().trim().max(50).default(""),
  isActive: z.boolean().default(true),
  dismissible: z.boolean().default(true),
});

export async function saveAnnouncement(request: Request): Promise<{ ok: boolean; id: string }> {
  const admin = await requireAdmin(request);
  const parsed = announcementSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message || "参数错误");
  }

  const d = parsed.data;
  const db = bindings().DB;
  const now = Date.now();
  const id = d.id || crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO announcements (id,title,content,type,link_url,link_text,is_active,dismissible,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title,
         content=excluded.content,
         type=excluded.type,
         link_url=excluded.link_url,
         link_text=excluded.link_text,
         is_active=excluded.is_active,
         dismissible=excluded.dismissible,
         updated_at=excluded.updated_at`,
    )
    .bind(
      id,
      d.title,
      d.content,
      d.type,
      d.linkUrl,
      d.linkText,
      d.isActive ? 1 : 0,
      d.dismissible ? 1 : 0,
      now,
      now,
    )
    .run();

  await db
    .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
    .bind(
      crypto.randomUUID(),
      admin.id,
      `announcement.${d.id ? "updated" : "created"}:${d.title}`,
      id,
      now,
    );

  return { ok: true, id };
}

export async function toggleAnnouncement(request: Request): Promise<{ ok: boolean }> {
  const admin = await requireAdmin(request);
  const parsed = z
    .object({
      id: z.string().min(1),
      isActive: z.boolean(),
    })
    .safeParse(await body(request));
  if (!parsed.success) throw new HttpError(400, "无效的公告 ID 或状态");

  const { id, isActive } = parsed.data;
  const db = bindings().DB;
  const now = Date.now();

  await db
    .prepare("UPDATE announcements SET is_active=?, updated_at=? WHERE id=?")
    .bind(isActive ? 1 : 0, now, id)
    .run();

  await db
    .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
    .bind(
      crypto.randomUUID(),
      admin.id,
      `announcement.toggle:${isActive ? "active" : "inactive"}`,
      id,
      now,
    );

  return { ok: true };
}

export async function deleteAnnouncement(request: Request, id: string): Promise<{ ok: boolean }> {
  const admin = await requireAdmin(request);
  const db = bindings().DB;
  await db.prepare("DELETE FROM announcements WHERE id=?").bind(id).run();

  await db
    .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), admin.id, "announcement.deleted", id, Date.now());

  return { ok: true };
}
