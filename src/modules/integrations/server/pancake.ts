import "@tanstack/react-start/server-only";
import { createHash, sign, verify } from "node:crypto";
import { bindings, required } from "@/server/env";
import { HttpError } from "@/server/http";

// Payment and content safety use the same merchant-level signed API.
// The key selects test/prod; never send a Store Slug or X-Environment override.
export async function pancakeApi<T>(path: string, input: unknown): Promise<T> {
  if (!path.startsWith("/v1/")) throw new Error("Invalid Pancake path");
  const env = bindings();
  const body = JSON.stringify(input);
  const time = String(Math.floor(Date.now() / 1000));
  const hash = createHash("sha256").update(body).digest("base64");
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`POST\n${path}\n${time}\n${hash}`),
    required(env.PANCAKE_PRIVATE_KEY, "PANCAKE_PRIVATE_KEY").replaceAll(
      "\\n",
      "\n",
    ),
  ).toString("base64");
  const baseUrl = (
    env.PANCAKE_BASE_URL?.trim() || "https://api.waffo.ai"
  ).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Merchant-Id": required(env.PANCAKE_MERCHANT_ID, "PANCAKE_MERCHANT_ID"),
      "X-Timestamp": time,
      "X-Signature": signature,
    },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Pancake request failed");
  const result = (await response.json()) as {
    data?: T;
    errors?: unknown[];
    error?: unknown;
  };
  // GraphQL can return HTTP 200 with partial data and errors. Never reconcile it.
  if (!result || result.errors?.length || result.error || result.data == null)
    throw new Error("Invalid Pancake response");
  return result.data;
}

export function verifyPancakeWebhook(raw: string, header: string | null) {
  try {
    const match = /^t=(\d+),v1=([A-Za-z0-9+/]+={0,2})$/.exec(header || "");
    if (!match || Math.abs(Date.now() - Number(match[1])) > 45 * 60 * 1000)
      throw new Error();
    const key = required(
      bindings().PANCAKE_WEBHOOK_PUBLIC_KEY,
      "PANCAKE_WEBHOOK_PUBLIC_KEY",
    ).replaceAll("\\n", "\n");
    if (
      !verify(
        "RSA-SHA256",
        Buffer.from(`${match[1]}.${raw}`),
        key,
        Buffer.from(match[2], "base64"),
      )
    )
      throw new Error();
  } catch {
    throw new HttpError(401, "支付通知签名无效。");
  }
}
