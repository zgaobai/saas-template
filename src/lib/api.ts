export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const data: unknown = await r.json().catch(() => null);
  if (r.status === 401) throw new Error("登录已过期，请重新登录。");
  if (!r.ok)
    throw new Error(
      typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
        ? data.error
        : "请求失败，请稍后重试。",
    );
  return data as T;
}
