import "@tanstack/react-start/server-only";

export interface ModelPricing {
  promptMicroUsdPer1k: number;     // micro-USD per 1,000 prompt tokens (1 USD = 1,000,000 micros)
  completionMicroUsdPer1k: number; // micro-USD per 1,000 completion tokens
}

export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  "gpt-4o-mini": { promptMicroUsdPer1k: 150, completionMicroUsdPer1k: 600 },
  "gpt-4o": { promptMicroUsdPer1k: 2500, completionMicroUsdPer1k: 10000 },
  "gpt-4-turbo": { promptMicroUsdPer1k: 10000, completionMicroUsdPer1k: 30000 },
  "gpt-3.5-turbo": { promptMicroUsdPer1k: 500, completionMicroUsdPer1k: 1500 },
  // DeepSeek Models (approx micro-USD converted from CNY)
  "deepseek-chat": { promptMicroUsdPer1k: 140, completionMicroUsdPer1k: 280 },
  "deepseek-reasoner": { promptMicroUsdPer1k: 550, completionMicroUsdPer1k: 2190 },
  "deepseek-coder": { promptMicroUsdPer1k: 140, completionMicroUsdPer1k: 280 },
  // Claude Models
  "claude-3-5-sonnet": { promptMicroUsdPer1k: 3000, completionMicroUsdPer1k: 15000 },
  "claude-3-haiku": { promptMicroUsdPer1k: 250, completionMicroUsdPer1k: 1250 },
  // Qwen Models
  "qwen-plus": { promptMicroUsdPer1k: 110, completionMicroUsdPer1k: 280 },
  "qwen-turbo": { promptMicroUsdPer1k: 40, completionMicroUsdPer1k: 80 },
};

export const FIXED_MODALITY_PRICING_MICROS: Record<string, number> = {
  "black-forest-labs/FLUX.1-schnell": 3000, // ~$0.003
  "dall-e-3": 40000,                        // ~$0.040
  "dall-e-2": 20000,                        // ~$0.020
  video: 50000,                             // ~$0.050
  audio: 10000,                             // ~$0.010
};

/**
 * Calculates underlying API expense in micro-USD (integer).
 * 1 USD = 1,000,000 micros.
 */
export function estimateTokenCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const normalized = (model || "").trim().toLowerCase();
  let pricing = DEFAULT_MODEL_PRICING[normalized];
  if (!pricing) {
    for (const key of Object.keys(DEFAULT_MODEL_PRICING)) {
      if (normalized.includes(key)) {
        pricing = DEFAULT_MODEL_PRICING[key];
        break;
      }
    }
  }
  const rate = pricing || DEFAULT_MODEL_PRICING["gpt-4o-mini"];
  const promptCost = Math.round(
    (Math.max(0, promptTokens) / 1000) * rate.promptMicroUsdPer1k,
  );
  const completionCost = Math.round(
    (Math.max(0, completionTokens) / 1000) * rate.completionMicroUsdPer1k,
  );
  return promptCost + completionCost;
}

export function formatCostUsd(micros: number): string {
  if (!micros || micros <= 0) return "$0.00";
  const usd = micros / 1_000_000;
  if (usd < 0.0001) return "<$0.0001";
  if (usd < 0.05) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
