import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";
export async function upload(request: Request, userId: string) {
  const limit = 10 * 1024 * 1024;
  if (Number(request.headers.get("content-length") || 0) > limit + 65536)
    throw new HttpError(413, "文件不能超过 10 MB。");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请选择文件。");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit + 65536) {
      await reader.cancel();
      throw new HttpError(413, "文件不能超过 10 MB。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
  } catch {
    throw new HttpError(400, "文件格式不正确，请重新选择后上传。");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new HttpError(400, "请选择非空文件。");
  if (file.size > limit) throw new HttpError(413, "文件不能超过 10 MB。");
  const allowed = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "text/plain",
  ];
  if (!allowed.includes(file.type))
    throw new HttpError(400, "支持 PNG、JPG、WebP、PDF 和 TXT。");
  const db = bindings().DB;
  const id = crypto.randomUUID();
  const key = `${userId}/${id}`;
  // Reserving before R2 put lets the database trigger enforce concurrent quotas.
  try {
    await db
      .prepare(
        "INSERT INTO files (id,user_id,name,key,size,content_type,created_at,status,updated_at) VALUES (?,?,?,?,?,?,?,'uploading',?)",
      )
      .bind(
        id,
        userId,
        file.name.slice(0, 180),
        key,
        file.size,
        file.type,
        Date.now(),
        Date.now(),
      )
      .run();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("storage_quota_exceeded")
    )
      throw new HttpError(
        409,
        "存储空间或文件数量已达上限，请删除部分文件后重试。",
      );
    throw error;
  }
  try {
    // MIME is only a format hint. Downloads are always attachments, never inline.
    await bindings().FILES.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { fileId: id, ownerId: userId, size: String(file.size) },
    });
    const result = await db
      .prepare(
        "UPDATE files SET status='ready',updated_at=? WHERE id=? AND user_id=? AND status='uploading'",
      )
      .bind(Date.now(), id, userId)
      .run();
    if (!result.meta.changes) {
      // A manual deletion may have claimed an interrupted upload.
      const current = await db
        .prepare("SELECT status FROM files WHERE id=? AND user_id=?")
        .bind(id, userId)
        .first<{ status: string }>();
      if (current?.status !== "ready")
        throw new Error("upload_reservation_expired");
    }
  } catch {
    // One immediate rollback attempt; retain the row for manual deletion on failure.
    try {
      await db
        .prepare(
          "UPDATE files SET status='deleting',updated_at=? WHERE id=? AND user_id=?",
        )
        .bind(Date.now(), id, userId)
        .run();
      await deleteObject({ id, user_id: userId, key });
    } catch {
      /* The owner can see and manually delete the incomplete file. */
    }
    throw new HttpError(
      502,
      "上传失败，请重试；列表中若有未完成文件，请先手动删除。",
    );
  }
  return { id };
}

type FileRecord = {
  id: string;
  user_id: string;
  key: string;
  status: string;
  updated_at: number;
};
async function deleteObject(row: Pick<FileRecord, "id" | "user_id" | "key">) {
  await bindings().FILES.delete(row.key);
  await bindings()
    .DB.prepare(
      "DELETE FROM files WHERE id=? AND user_id=? AND status='deleting'",
    )
    .bind(row.id, row.user_id)
    .run();
}
export async function listFiles(userId: string) {
  const files = await bindings()
    .DB.prepare(
      "SELECT id,name,size,content_type,created_at,status FROM files WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
    )
    .bind(userId)
    .all();
  return { files: files.results };
}

export async function download(id: string, userId: string) {
  const row = await bindings()
    .DB.prepare(
      "SELECT key,name FROM files WHERE id=? AND user_id=? AND status='ready'",
    )
    .bind(id, userId)
    .first<{ key: string; name: string }>();
  if (!row) throw new HttpError(404, "文件不存在。");
  const object = await bindings().FILES.get(row.key);
  if (!object) throw new HttpError(404, "文件暂不可用。");
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
export async function remove(id: string, userId: string) {
  const row = await bindings()
    .DB.prepare(
      "SELECT id,user_id,key,status,updated_at FROM files WHERE id=? AND user_id=?",
    )
    .bind(id, userId)
    .first<FileRecord>();
  if (!row) throw new HttpError(404, "文件不存在。");
  if (row.status === "uploading" && row.updated_at > Date.now() - 300000)
    throw new HttpError(409, "文件正在上传，请稍后重试。");
  await bindings()
    .DB.prepare(
      "UPDATE files SET status='deleting',updated_at=? WHERE id=? AND user_id=? AND status IN ('ready','deleting','uploading')",
    )
    .bind(Date.now(), id, userId)
    .run();
  try {
    await deleteObject(row);
  } catch {
    throw new HttpError(502, "删除未完成，请稍后再次点击删除。");
  }
  return { ok: true };
}
