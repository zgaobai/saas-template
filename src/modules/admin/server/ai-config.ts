import "@tanstack/react-start/server-only";
import { z } from "zod";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { bindings } from "@/server/env";
import { body, HttpError } from "@/server/http";
import { requireAdmin } from "@/modules/auth/server/session";

function getEncryptionKey(): Buffer {
  const env = bindings();
  const raw =
    env.REDEMPTION_ENCRYPTION_KEY ||
    env.BETTER_AUTH_SECRET ||
    "fallback-saas-encryption-secret-seed-32b!";
  return createHash("sha256").update(raw).digest();
}

export function encryptApiKey(apiKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from("ai-gateway-config"));
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptApiKey(value: string): string {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra)
    throw new Error("Invalid API key ciphertext envelope");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from("ai-gateway-config"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) return "sk-****";
  return trimmed.slice(0, 7) + "…" + trimmed.slice(-4);
}

export type ModelOption = {
  id: string;
  name: string;
  isDefault?: boolean;
};

export function parseModelList(
  rawJson: string | null | undefined,
  fallbackId?: string | null,
): ModelOption[] {
  if (rawJson && rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const items: ModelOption[] = [];
        for (const item of parsed) {
          if (item && typeof item.id === "string" && item.id.trim()) {
            items.push({
              id: item.id.trim(),
              name:
                typeof item.name === "string" && item.name.trim()
                  ? item.name.trim()
                  : item.id.trim(),
              isDefault: Boolean(item.isDefault),
            });
          }
        }
        if (items.length > 0) {
          if (!items.some((i) => i.isDefault)) {
            items[0].isDefault = true;
          }
          return items;
        }
      }
    } catch {
      // Fall through to fallback
    }
  }

  if (fallbackId && fallbackId.trim()) {
    return [{ id: fallbackId.trim(), name: fallbackId.trim(), isDefault: true }];
  }

  return [];
}

export function getDefaultModelId(
  models: ModelOption[],
  fallback: string,
): string {
  const found = models.find((m) => m.isDefault);
  return found?.id || models[0]?.id || fallback;
}

export type ResolvedAiConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
  textModels: ModelOption[];
  imageModels: ModelOption[];
  videoModels: ModelOption[];
  audioModels: ModelOption[];
  apiStyle: "chat" | "responses";
  source: "database" | "environment";
};

export async function getActiveAiConfig(
  requestedModel?: string,
): Promise<ResolvedAiConfig | null> {
  const db = bindings().DB;
  try {
    const row = await db
      .prepare(
        "SELECT base_url, api_key_ciphertext, api_style, text_model, text_models_json, image_model, image_models_json, video_model, video_models_json, audio_model, audio_models_json, enabled FROM ai_configs WHERE id='default'",
      )
      .first<{
        base_url: string | null;
        api_key_ciphertext: string | null;
        api_style: string;
        text_model: string;
        text_models_json: string | null;
        image_model: string | null;
        image_models_json: string | null;
        video_model: string | null;
        video_models_json: string | null;
        audio_model: string | null;
        audio_models_json: string | null;
        enabled: number;
      }>();

    if (row && Boolean(row.enabled) && row.api_key_ciphertext) {
      const apiKey = decryptApiKey(row.api_key_ciphertext);
      const textModels = parseModelList(
        row.text_models_json,
        row.text_model || "deepseek-ai/DeepSeek-V3",
      );
      const imageModels = parseModelList(
        row.image_models_json,
        row.image_model || "black-forest-labs/FLUX.1-schnell",
      );
      const videoModels = parseModelList(
        row.video_models_json,
        row.video_model || "kling-v1",
      );
      const audioModels = parseModelList(
        row.audio_models_json,
        row.audio_model || "suno-v3.5",
      );

      let chosenTextModel = getDefaultModelId(
        textModels,
        row.text_model || "deepseek-ai/DeepSeek-V3",
      );
      if (requestedModel && textModels.some((m) => m.id === requestedModel)) {
        chosenTextModel = requestedModel;
      }

      return {
        apiKey,
        baseURL: row.base_url?.trim() || undefined,
        model: chosenTextModel,
        textModels,
        imageModels,
        videoModels,
        audioModels,
        apiStyle: row.api_style === "responses" ? "responses" : "chat",
        source: "database",
      };
    }
  } catch {
    // If table not yet ready or query fails, fallback to environment seamlessly
  }

  const env = bindings();
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim()) {
    const envModel = env.AI_MODEL?.trim() || "gpt-4.1-mini";
    const textModels = [{ id: envModel, name: envModel, isDefault: true }];
    return {
      apiKey: env.OPENAI_API_KEY.trim(),
      baseURL: env.AI_BASE_URL?.trim() || undefined,
      model: requestedModel || envModel,
      textModels,
      imageModels: [{ id: "dall-e-3", name: "DALL-E 3", isDefault: true }],
      videoModels: [],
      audioModels: [],
      apiStyle: env.AI_API_STYLE === "responses" ? "responses" : "chat",
      source: "environment",
    };
  }

  return null;
}

export async function getPublicAiModels() {
  const active = await getActiveAiConfig();
  if (!active) {
    return {
      textModels: [],
      imageModels: [],
      videoModels: [],
      audioModels: [],
    };
  }
  return {
    textModels: active.textModels,
    imageModels: active.imageModels,
    videoModels: active.videoModels,
    audioModels: active.audioModels,
  };
}

export async function getAdminAiConfig(request: Request) {
  await requireAdmin(request);
  const db = bindings().DB;
  const row = await db
    .prepare(
      "SELECT base_url, api_key_hint, api_key_ciphertext, api_style, text_model, text_models_json, image_model, image_models_json, video_model, video_models_json, audio_model, audio_models_json, enabled, updated_at FROM ai_configs WHERE id='default'",
    )
    .first<{
      base_url: string | null;
      api_key_hint: string | null;
      api_key_ciphertext: string | null;
      api_style: string;
      text_model: string;
      text_models_json: string | null;
      image_model: string | null;
      image_models_json: string | null;
      video_model: string | null;
      video_models_json: string | null;
      audio_model: string | null;
      audio_models_json: string | null;
      enabled: number;
      updated_at: number;
    }>();

  const env = bindings();
  const hasDbKey = Boolean(row?.api_key_ciphertext);
  const hasEnvKey = Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim());

  const textModels = parseModelList(
    row?.text_models_json,
    row?.text_model || env.AI_MODEL || "deepseek-ai/DeepSeek-V3",
  );
  const imageModels = parseModelList(
    row?.image_models_json,
    row?.image_model || "black-forest-labs/FLUX.1-schnell",
  );
  const videoModels = parseModelList(
    row?.video_models_json,
    row?.video_model || "kling-v1",
  );
  const audioModels = parseModelList(
    row?.audio_models_json,
    row?.audio_model || "suno-v3.5",
  );

  return {
    config: {
      baseUrl: row?.base_url ?? "",
      apiKeyHint:
        row?.api_key_hint ??
        (hasEnvKey ? maskApiKey(env.OPENAI_API_KEY!) : ""),
      hasApiKey: hasDbKey || hasEnvKey,
      apiStyle:
        (row?.api_style as "chat" | "responses") ||
        env.AI_API_STYLE ||
        "chat",
      textModel: row?.text_model || env.AI_MODEL || "deepseek-ai/DeepSeek-V3",
      textModels,
      imageModel: row?.image_model ?? "black-forest-labs/FLUX.1-schnell",
      imageModels,
      videoModel: row?.video_model ?? "kling-v1",
      videoModels,
      audioModel: row?.audio_model ?? "suno-v3.5",
      audioModels,
      enabled: row ? Boolean(row.enabled) : true,
      updatedAt: row?.updated_at ?? null,
      source: hasDbKey ? "database" : hasEnvKey ? "environment" : "none",
    },
  };
}

const modelItemSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().max(128).default(""),
  isDefault: z.boolean().default(false),
});

const aiConfigInputSchema = z
  .object({
    baseUrl: z.string().trim().max(500).default(""),
    apiKey: z.string().trim().max(500).default(""),
    apiStyle: z.enum(["chat", "responses"]).default("chat"),
    textModel: z.string().trim().max(128).default(""),
    textModels: z.array(modelItemSchema).default([]),
    imageModel: z.string().trim().max(128).default(""),
    imageModels: z.array(modelItemSchema).default([]),
    videoModel: z.string().trim().max(128).default(""),
    videoModels: z.array(modelItemSchema).default([]),
    audioModel: z.string().trim().max(128).default(""),
    audioModels: z.array(modelItemSchema).default([]),
    enabled: z.boolean().default(true),
  })
  .strict();

export async function saveAdminAiConfig(request: Request) {
  const admin = await requireAdmin(request);
  const parsed = aiConfigInputSchema.safeParse(await body(request));
  if (!parsed.success) throw new HttpError(400, "参数格式不正确，请核对后提交。");

  const data = parsed.data;
  let normalizedBaseUrl: string | null = null;
  if (data.baseUrl) {
    try {
      const u = new URL(data.baseUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:")
        throw new Error();
      normalizedBaseUrl = u.toString().replace(/\/+$/, "");
    } catch {
      throw new HttpError(400, "网关接口地址必须为有效的 HTTP 或 HTTPS 链接。");
    }
  }

  // Normalize model lists
  let textList = data.textModels;
  if (textList.length === 0 && data.textModel) {
    textList = [{ id: data.textModel, name: data.textModel, isDefault: true }];
  }
  if (textList.length === 0) {
    textList = [
      {
        id: "deepseek-ai/DeepSeek-V3",
        name: "DeepSeek V3",
        isDefault: true,
      },
    ];
  }
  if (!textList.some((m) => m.isDefault)) {
    textList[0].isDefault = true;
  }
  const primaryTextModel = getDefaultModelId(
    textList,
    "deepseek-ai/DeepSeek-V3",
  );

  let imageList = data.imageModels;
  if (imageList.length === 0 && data.imageModel) {
    imageList = [{ id: data.imageModel, name: data.imageModel, isDefault: true }];
  }
  const primaryImageModel = imageList.length > 0 ? getDefaultModelId(imageList, "") : (data.imageModel || null);

  let videoList = data.videoModels;
  if (videoList.length === 0 && data.videoModel) {
    videoList = [{ id: data.videoModel, name: data.videoModel, isDefault: true }];
  }
  const primaryVideoModel = videoList.length > 0 ? getDefaultModelId(videoList, "") : (data.videoModel || null);

  let audioList = data.audioModels;
  if (audioList.length === 0 && data.audioModel) {
    audioList = [{ id: data.audioModel, name: data.audioModel, isDefault: true }];
  }
  const primaryAudioModel = audioList.length > 0 ? getDefaultModelId(audioList, "") : (data.audioModel || null);

  const db = bindings().DB;
  const existing = await db
    .prepare(
      "SELECT api_key_ciphertext, api_key_hint FROM ai_configs WHERE id='default'",
    )
    .first<{ api_key_ciphertext: string | null; api_key_hint: string | null }>();

  let finalCiphertext = existing?.api_key_ciphertext || null;
  let finalHint = existing?.api_key_hint || null;

  if (data.apiKey) {
    finalCiphertext = encryptApiKey(data.apiKey);
    finalHint = maskApiKey(data.apiKey);
  }

  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO ai_configs (
           id, base_url, api_key_ciphertext, api_key_hint, api_style,
           text_model, text_models_json,
           image_model, image_models_json,
           video_model, video_models_json,
           audio_model, audio_models_json,
           enabled, updated_at, updated_by
         )
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           base_url=excluded.base_url,
           api_key_ciphertext=COALESCE(excluded.api_key_ciphertext, ai_configs.api_key_ciphertext),
           api_key_hint=COALESCE(excluded.api_key_hint, ai_configs.api_key_hint),
           api_style=excluded.api_style,
           text_model=excluded.text_model,
           text_models_json=excluded.text_models_json,
           image_model=excluded.image_model,
           image_models_json=excluded.image_models_json,
           video_model=excluded.video_model,
           video_models_json=excluded.video_models_json,
           audio_model=excluded.audio_model,
           audio_models_json=excluded.audio_models_json,
           enabled=excluded.enabled,
           updated_at=excluded.updated_at,
           updated_by=excluded.updated_by`,
      )
      .bind(
        normalizedBaseUrl,
        finalCiphertext,
        finalHint,
        data.apiStyle,
        primaryTextModel,
        JSON.stringify(textList),
        primaryImageModel,
        JSON.stringify(imageList),
        primaryVideoModel,
        JSON.stringify(videoList),
        primaryAudioModel,
        JSON.stringify(audioList),
        data.enabled ? 1 : 0,
        now,
        admin.id,
      ),
    db
      .prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        admin.id,
        "ai_config.updated:" + primaryTextModel,
        "ai_configs:default",
        now,
      ),
  ]);

  return { ok: true, updatedAt: now };
}

export async function testAdminAiConnection(request: Request) {
  await requireAdmin(request);
  const input = z
    .object({
      baseUrl: z.string().trim().max(500).default(""),
      apiKey: z.string().trim().max(500).default(""),
      apiStyle: z.enum(["chat", "responses"]).default("chat"),
      textModel: z
        .string()
        .trim()
        .min(1)
        .max(128)
        .default("deepseek-ai/DeepSeek-V3"),
      model: z.string().trim().max(128).optional(),
    })
    .safeParse(await body(request));

  if (!input.success) throw new HttpError(400, "测试参数不正确。");

  let apiKeyToTest = input.data.apiKey;
  let baseUrlToTest = input.data.baseUrl;
  const modelToTest =
    input.data.model?.trim() || input.data.textModel?.trim() || "deepseek-ai/DeepSeek-V3";

  if (!apiKeyToTest) {
    const active = await getActiveAiConfig();
    if (active) {
      apiKeyToTest = active.apiKey;
      if (!baseUrlToTest && active.baseURL) baseUrlToTest = active.baseURL;
    }
  }

  if (!apiKeyToTest) {
    throw new HttpError(400, "请先输入 API 密钥再进行连通性测试。");
  }

  const start = Date.now();
  try {
    const provider = createOpenAI({
      apiKey: apiKeyToTest,
      baseURL: baseUrlToTest || undefined,
    });

    const modelInstance =
      input.data.apiStyle === "responses"
        ? provider.responses(modelToTest)
        : provider.chat(modelToTest);

    const result = await generateText({
      model: modelInstance,
      prompt: "Reply with the single word 'OK'",
      maxOutputTokens: 5,
      abortSignal: AbortSignal.timeout(12000),
    });

    const latencyMs = Date.now() - start;
    return {
      ok: true,
      latencyMs,
      response: result.text.slice(0, 50).trim(),
      model: modelToTest,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      latencyMs,
      error: error?.message || "连通性测试失败，请检查地址、密钥或模型代号。",
    };
  }
}
