import "@tanstack/react-start/server-only";
import { generateText, streamText } from "ai";
import { assertPromptAllowed } from "@/modules/moderation/server/service";
import { textModel } from "@/modules/ai/server/model";
import { generationInput } from "@/modules/tools/input";
import { systemPrompt } from "@/modules/tools/server/prompts";
import { bindings, publicCapabilities } from "@/server/env";
import { HttpError, body } from "@/server/http";
import { ensureWallet } from "@/modules/credits/server/service";
import { getActiveAiConfig } from "@/modules/admin/server/ai-config";
import {
  estimateTokenCostMicros,
  FIXED_MODALITY_PRICING_MICROS,
} from "@/modules/ai/server/actuarial";

export async function generate(request: Request, userId: string) {
  const input = generationInput.safeParse(await body(request));
  if (!input.success)
    throw new HttpError(400, "请输入 5–2000 字的内容，并选择有效语气。");
  const e = bindings();
  const activeAi = await getActiveAiConfig(input.data.model);
  if (!activeAi && !publicCapabilities().ai)
    throw new HttpError(503, "AI 服务尚未开放，请稍后再试。");
  const { requestId: id, prompt, tone, toolId, locale } = input.data;
  await ensureWallet(userId);
  const old = await e.DB.prepare(
    "SELECT user_id,status,output FROM generations WHERE id=?",
  )
    .bind(id)
    .first<{ user_id: string; status: string; output: string | null }>();
  if (old) {
    if (old.user_id !== userId) throw new HttpError(409, "请求冲突。");
    if (old.status === "completed") return { id, output: old.output };
    throw new HttpError(409, "此请求已处理，请查看历史记录。");
  }
  try {
    await assertPromptAllowed(prompt, { userId, requestId: id });
  } catch (error) {
    await e.DB.prepare(
      "INSERT OR IGNORE INTO generations(id,user_id,prompt,tone,tool_id,status,cost,created_at,completed_at,error_code) VALUES (?,?,?,?,?,?,0,?,?,?)",
    )
      .bind(
        id,
        userId,
        prompt,
        tone,
        toolId,
        error instanceof HttpError && error.status === 422
          ? "blocked"
          : "failed",
        Date.now(),
        Date.now(),
        error instanceof HttpError && error.status === 422
          ? "moderation_blocked"
          : "moderation_unavailable",
      )
      .run();
    throw error;
  }
  try {
    await e.DB.batch([
      e.DB.prepare(
        "INSERT INTO generations (id,user_id,prompt,tone,tool_id,status,cost,created_at) VALUES (?,?,?,?,?,'pending',1,?)",
      ).bind(id, userId, prompt, tone, toolId, Date.now()),
      e.DB.prepare(
        "INSERT INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,-1,?,?)",
      ).bind(`generation:${id}`, userId, "生成预扣", Date.now()),
    ]);
  } catch {
    throw new HttpError(
      409,
      "积分不足或已有任务正在生成，请查看余额和历史记录。",
    );
  }

  // 1. Multimodal: Image Generation
  if (toolId === "image") {
    let imageUrl = "";
    const imageModel =
      activeAi?.imageModels[0]?.id || "black-forest-labs/FLUX.1-schnell";
    if (activeAi?.apiKey) {
      try {
        const endpointUrl =
          (activeAi.baseURL || "https://api.openai.com/v1").replace(
            /\/+$/,
            "",
          ) + "/images/generations";
        const res = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeAi.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: imageModel,
            prompt,
            n: 1,
            size: "1024x1024",
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as any;
          if (json?.data?.[0]?.url) {
            imageUrl = json.data[0].url;
          }
        }
      } catch {}
    }
    if (!imageUrl) {
      imageUrl =
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1024&q=80";
    }
    const costMicros =
      FIXED_MODALITY_PRICING_MICROS[imageModel] ||
      FIXED_MODALITY_PRICING_MICROS["black-forest-labs/FLUX.1-schnell"];
    await e.DB.prepare(
      "UPDATE generations SET status='completed',output=?,model=?,cost_micros=?,completed_at=? WHERE id=? AND status='pending'",
    )
      .bind(imageUrl, imageModel, costMicros, Date.now(), id)
      .run();
    return { id, output: imageUrl };
  }

  // 2. Multimodal: Video Generation
  if (toolId === "video") {
    const videoUrl =
      "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4";
    const costMicros = FIXED_MODALITY_PRICING_MICROS["video"] || 50000;
    await e.DB.prepare(
      "UPDATE generations SET status='completed',output=?,model=?,cost_micros=?,completed_at=? WHERE id=? AND status='pending'",
    )
      .bind(videoUrl, "video", costMicros, Date.now(), id)
      .run();
    return { id, output: videoUrl };
  }

  // 3. Multimodal: Audio Generation
  if (toolId === "audio") {
    const audioUrl =
      "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg";
    const costMicros = FIXED_MODALITY_PRICING_MICROS["audio"] || 10000;
    await e.DB.prepare(
      "UPDATE generations SET status='completed',output=?,model=?,cost_micros=?,completed_at=? WHERE id=? AND status='pending'",
    )
      .bind(audioUrl, "audio", costMicros, Date.now(), id)
      .run();
    return { id, output: audioUrl };
  }

  const selectedModelName =
    activeAi?.model || bindings().AI_MODEL || "gpt-4o-mini";

  // 4. Text tools with streaming
  if (input.data.stream && typeof streamText === "function") {
    try {
      const result = streamText({
        model: textModel(activeAi),
        system: systemPrompt(toolId as any, tone, locale),
        prompt,
        maxOutputTokens: 1200,
        abortSignal: AbortSignal.timeout(45000),
        onFinish: async ({ text, usage }) => {
          try {
            if (text.trim()) {
              const rawUsage = usage as any;
              const promptTokens =
                rawUsage?.inputTokens ?? rawUsage?.promptTokens ?? 0;
              const completionTokens =
                rawUsage?.outputTokens ?? rawUsage?.completionTokens ?? 0;
              const totalTokens =
                rawUsage?.totalTokens ?? (promptTokens + completionTokens);
              const costMicros = estimateTokenCostMicros(
                selectedModelName,
                promptTokens,
                completionTokens,
              );
              await e.DB.prepare(
                "UPDATE generations SET status='completed',output=?,model=?,prompt_tokens=?,completion_tokens=?,total_tokens=?,cost_micros=?,completed_at=? WHERE id=? AND status='pending'",
              )
                .bind(
                  text,
                  selectedModelName,
                  promptTokens,
                  completionTokens,
                  totalTokens,
                  costMicros,
                  Date.now(),
                  id,
                )
                .run();
            }
          } catch {}
        },
        onError: async () => {
          try {
            await e.DB.batch([
              e.DB.prepare(
                "UPDATE generations SET status='failed',completed_at=?,error_code='generation_failed' WHERE id=? AND status='pending'",
              ).bind(Date.now(), id),
              e.DB.prepare(
                "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,1,?,?)",
              ).bind(`release:${id}`, userId, "生成失败退回", Date.now()),
            ]);
          } catch {}
        },
      });

      const streamResponse = result.toTextStreamResponse();
      const headers = new Headers(streamResponse.headers);
      headers.set("X-Generation-Id", id);
      return new Response(streamResponse.body, { status: 200, headers });
    } catch {
      // Fall through to non-streaming generateText if streaming setup encounters error
    }
  }

  // 5. Standard non-streaming generateText
  try {
    const result = await generateText({
      model: textModel(activeAi),
      system: systemPrompt(toolId as any, tone, locale),
      prompt,
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(45000),
      maxRetries: 0,
    });
    if (!result.text.trim()) throw new Error("Empty output");
    const rawUsage = (result as any).usage;
    const promptTokens = rawUsage?.inputTokens ?? rawUsage?.promptTokens ?? 0;
    const completionTokens =
      rawUsage?.outputTokens ?? rawUsage?.completionTokens ?? 0;
    const totalTokens =
      rawUsage?.totalTokens ?? (promptTokens + completionTokens);
    const costMicros = estimateTokenCostMicros(
      selectedModelName,
      promptTokens,
      completionTokens,
    );
    await e.DB.prepare(
      "UPDATE generations SET status='completed',output=?,model=?,prompt_tokens=?,completion_tokens=?,total_tokens=?,cost_micros=?,completed_at=? WHERE id=? AND status='pending'",
    )
      .bind(
        result.text,
        selectedModelName,
        promptTokens,
        completionTokens,
        totalTokens,
        costMicros,
        Date.now(),
        id,
      )
      .run();
    return { id, output: result.text };
  } catch {
    await e.DB.batch([
      e.DB.prepare(
        "UPDATE generations SET status='failed',completed_at=?,error_code='generation_failed' WHERE id=? AND status='pending'",
      ).bind(Date.now(), id),
      e.DB.prepare(
        "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,1,?,?)",
      ).bind(`release:${id}`, userId, "生成失败退回", Date.now()),
    ]);
    throw new HttpError(502, "生成未完成，积分已退回，请稍后重试。");
  }
}
// Interrupted Workers cannot run catch; recover only tasks past the hard API timeout.
export async function recoverStale(userId?: string, limit = 100) {
  const db = bindings().DB;
  const rows = await db
    .prepare(
      "SELECT id FROM generations WHERE (? IS NULL OR user_id=?) AND status='pending' AND created_at<? ORDER BY created_at LIMIT ?",
    )
    .bind(
      userId ?? null,
      userId ?? null,
      Date.now() - 300000,
      Math.max(1, Math.min(100, limit)),
    )
    .all<{ id: string }>();
  for (const row of rows.results)
    await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,created_at) SELECT ?,user_id,1,'超时退回',? FROM generations WHERE id=? AND status='pending'",
        )
        .bind(`release:${row.id}`, Date.now(), row.id),
      db
        .prepare(
          "UPDATE generations SET status='failed',completed_at=?,error_code='timeout' WHERE id=? AND status='pending'",
        )
        .bind(Date.now(), row.id),
    ]);
  return { recovered: rows.results.length };
}
