import "@tanstack/react-start/server-only";
import { bindings, required } from "@/server/env";
import { HttpError } from "@/server/http";
import { pancakeApi } from "@/modules/integrations/server/pancake";

/** Reusable prompt gate. This API does not inspect binary uploads or generated media. */
export async function assertPromptAllowed(
  prompt: string,
  context: { userId: string; requestId: string },
) {
  const e = bindings();
  const provider = e.MODERATION_PROVIDER || "pancake";
  if (provider === "disabled") {
    if (e.APP_ENV === "development") return;
    throw new HttpError(503, "内容审核服务尚未配置。");
  }
  if (!prompt.trim() || [...prompt].length > 10000)
    throw new HttpError(400, "审核内容长度不符合要求。");
  let decision: "allow" | "review" | "block" = "review";
  try {
    if (provider === "pancake") {
      const result = await pancakeApi<{ action: string; reasonCode: string }>(
        "/v1/actions/verification/scan-prompt",
        { prompt, locale: "zh", semantic: "enforce" },
      );
      if (result.action === "allow" && result.reasonCode === "allowed")
        decision = "allow";
      else if (
        result.action === "block" &&
        result.reasonCode === "restricted_content"
      )
        decision = "block";
      else if (
        result.action !== "review" ||
        result.reasonCode === "service_degraded"
      )
        throw new Error();
    } else if (provider === "creem") {
      const creemBase = (
        e.CREEM_BASE_URL?.trim() ||
        (e.CREEM_ENVIRONMENT === "production"
          ? "https://api.creem.io"
          : "https://test-api.creem.io")
      ).replace(/\/+$/, "");
      const response = await fetch(
        `${creemBase}/v1/moderation/prompt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": required(e.CREEM_API_KEY, "CREEM_API_KEY"),
          },
          body: JSON.stringify({ prompt, external_id: context.requestId }),
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { decision: string };
      if (result.decision === "allow") decision = "allow";
      else if (result.decision === "deny") decision = "block";
      else if (result.decision !== "flag") throw new Error();
    } else throw new Error();
  } catch {
    throw new HttpError(
      503,
      "内容审核暂时不可用，尚未开始生成或扣除积分，请稍后重试。",
      60,
    );
  }
  // Minimal audit evidence only: no prompt text, key, response body or raw error.
  await e.DB.prepare(
    "INSERT INTO audit_logs (id,actor_id,action,target_id,created_at) VALUES (?,?,?,?,?)",
  )
    .bind(
      crypto.randomUUID(),
      context.userId,
      `moderation:${provider}:${decision}`,
      context.requestId,
      Date.now(),
    )
    .run();
  if (decision !== "allow")
    throw new HttpError(
      422,
      "这段内容未通过审核，请调整后重试。尚未扣除积分。",
    );
}
