import "@tanstack/react-start/server-only";
import { bindings } from "./env";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export function assertOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(bindings().APP_URL).origin)
    throw new HttpError(403, "请求来源不受信任，请刷新页面后重试。");
}
export async function body(request: Request, max = 16384): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请求内容不能为空。");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > max) {
      await reader.cancel();
      throw new HttpError(413, "内容过长，请缩短后重试。");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    throw new HttpError(400, "请求格式不正确。");
  }
}
export async function endpoint(run: () => Promise<unknown>) {
  try {
    const value = await run();
    return value instanceof Response
      ? value
      : Response.json(value, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const requestId = crypto.randomUUID();
    // Never log request bodies, headers, third-party errors, or credentials.
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "request_failed",
          requestId,
        }),
      );
    return Response.json(
      {
        requestId,
        error:
          error instanceof HttpError
            ? error.message
            : "暂时无法完成，请稍后重试。",
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
          ...(error instanceof HttpError && error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : {}),
        },
      },
    );
  }
}
