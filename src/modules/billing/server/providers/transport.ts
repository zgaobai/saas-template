import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/server/http";

export async function rawWebhook(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "空通知。");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 262144) {
      await reader.cancel();
      throw new HttpError(413, "通知过大。");
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString("utf8");
}
export function verifyHmac(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature))
    throw new HttpError(401, "签名无效。");
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
    throw new HttpError(401, "签名无效。");
}
export async function providerJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  // Provider responses may contain credentials or personal data. Never surface their raw errors.
  if (!response.ok) throw new Error("Payment provider request failed");
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
export function providerId(value: unknown): string {
  const id =
    typeof value === "string" ? value : (value as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id))
    throw new Error("Invalid provider identity");
  return id;
}
export function timestamp(value: string | number | undefined): number {
  const result =
    typeof value === "number" ? value * 1000 : Date.parse(value || "");
  if (!Number.isFinite(result) || result <= 0)
    throw new Error("Invalid provider timestamp");
  return result;
}
