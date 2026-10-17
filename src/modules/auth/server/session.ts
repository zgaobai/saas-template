import "@tanstack/react-start/server-only";
import { auth } from "./auth";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";
export async function requireUser(request: Request) {
  const s = await auth().api.getSession({ headers: request.headers });
  if (!s) throw new HttpError(401, "请先登录。");
  const state = await bindings()
    .DB.prepare("SELECT disabled_at,closed_at FROM user WHERE id=?")
    .bind(s.user.id)
    .first<{ disabled_at: number | null; closed_at: number | null }>();
  if (!state || state.disabled_at !== null || state.closed_at !== null)
    throw new HttpError(403, "账户已停用或注销，请联系站点支持。");
  return s.user;
}
export async function requireAdmin(request: Request) {
  const u = await requireUser(request);
  if (
    !(bindings().ADMIN_USER_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .includes(u.id)
  )
    throw new HttpError(403, "你没有管理员权限。");
  return u;
}
