import { describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

vi.mock("@tanstack/react-start/server-only", () => ({}));

import {
  estimateTokenCostMicros,
  formatCostUsd,
  DEFAULT_MODEL_PRICING,
  FIXED_MODALITY_PRICING_MICROS,
} from "@/modules/ai/server/actuarial";

describe("Actuarial Token & Cost Tracking", () => {
  it("calculates exact micro-USD costs for standard models", () => {
    // gpt-4o-mini: 150 micros/1k prompt, 600 micros/1k completion
    const cost = estimateTokenCostMicros("gpt-4o-mini", 1000, 1000);
    expect(cost).toBe(750); // 150 + 600 = 750 micro-USD ($0.00075)

    // deepseek-chat: 140 micros/1k prompt, 280 micros/1k completion
    const deepseekCost = estimateTokenCostMicros("deepseek-chat", 2000, 1000);
    expect(deepseekCost).toBe(280 + 280); // 560 micros
  });

  it("matches prefix / versioned model variants", () => {
    // gpt-4o-mini-2024-07-18 matches gpt-4o-mini
    const cost = estimateTokenCostMicros("gpt-4o-mini-2024-07-18", 1000, 500);
    expect(cost).toBe(150 + 300); // 450 micros
  });

  it("handles empty, negative, or unknown models gracefully", () => {
    expect(estimateTokenCostMicros("unknown-model", 0, 0)).toBe(0);
    expect(estimateTokenCostMicros("gpt-4o-mini", -10, -50)).toBe(0);
  });

  it("formats micro-USD costs cleanly", () => {
    expect(formatCostUsd(0)).toBe("$0.00");
    expect(formatCostUsd(-100)).toBe("$0.00");
    expect(formatCostUsd(50)).toBe("<$0.0001");
    expect(formatCostUsd(750)).toBe("$0.0008");
    expect(formatCostUsd(12500)).toBe("$0.0125");
    expect(formatCostUsd(1500000)).toBe("$1.50");
  });

  it("has fixed costs defined for multimodal tools", () => {
    expect(FIXED_MODALITY_PRICING_MICROS["black-forest-labs/FLUX.1-schnell"]).toBe(3000);
    expect(FIXED_MODALITY_PRICING_MICROS["video"]).toBe(50000);
    expect(FIXED_MODALITY_PRICING_MICROS["audio"]).toBe(10000);
  });

  it("applies migration 0018 cleanly and supports token/cost columns in generations", () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync("migrations").sort()) {
      if (f.endsWith(".sql")) {
        db.exec(readFileSync("migrations/" + f, "utf8"));
      }
    }

    db.prepare("INSERT INTO user (id, email, name, created_at, updated_at) VALUES ('u1', 'u@test.com', 'User', 0, 0)").run();

    // Insert generation with legacy columns (should use default values for new columns)
    db.prepare(`
      INSERT INTO generations (id, user_id, prompt, tone, tool_id, status, cost, created_at)
      VALUES ('gen_legacy', 'u1', 'test prompt', 'tone', 'copywriting', 'completed', 1, 1000)
    `).run();

    const legacyRow = db.prepare("SELECT * FROM generations WHERE id='gen_legacy'").get() as any;
    expect(legacyRow.model).toBe("");
    expect(legacyRow.prompt_tokens).toBe(0);
    expect(legacyRow.completion_tokens).toBe(0);
    expect(legacyRow.total_tokens).toBe(0);
    expect(legacyRow.cost_micros).toBe(0);

    // Insert generation with new token tracking columns
    db.prepare(`
      INSERT INTO generations (id, user_id, prompt, tone, tool_id, status, cost, model, prompt_tokens, completion_tokens, total_tokens, cost_micros, created_at)
      VALUES ('gen_tracked', 'u1', 'test prompt', 'tone', 'copywriting', 'completed', 1, 'gpt-4o-mini', 420, 880, 1300, 678, 2000)
    `).run();

    const trackedRow = db.prepare("SELECT * FROM generations WHERE id='gen_tracked'").get() as any;
    expect(trackedRow.model).toBe("gpt-4o-mini");
    expect(trackedRow.prompt_tokens).toBe(420);
    expect(trackedRow.completion_tokens).toBe(880);
    expect(trackedRow.total_tokens).toBe(1300);
    expect(trackedRow.cost_micros).toBe(678);
  });
});
