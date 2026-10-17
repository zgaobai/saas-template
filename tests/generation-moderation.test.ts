import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  model: vi.fn(),
  batch: vi.fn(),
  run: vi.fn(),
  first: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/modules/moderation/server/service", () => ({
  assertPromptAllowed: mocks.gate,
}));
vi.mock("@/modules/ai/server/model", () => ({ textModel: () => "test_model" }));
vi.mock("ai", () => ({ generateText: mocks.model }));
vi.mock("@/modules/credits/server/service", () => ({ ensureWallet: vi.fn() }));
vi.mock("@/server/env", () => ({
  publicCapabilities: () => ({ ai: true }),
  bindings: () => ({
    DB: {
      prepare: () => ({ bind: () => ({ first: mocks.first, run: mocks.run }) }),
      batch: mocks.batch,
    },
  }),
}));
import { generate } from "@/modules/tools/server/generation";
import { HttpError } from "@/server/http";
const request = () =>
  new Request("https://app.test/api/app/generate", {
    method: "POST",
    body: JSON.stringify({
      requestId: "7e5a9a14-b5a7-49a0-8cc0-322332a169ad",
      prompt: "请写一段产品介绍",
      tone: "自然清晰",
      toolId: "copywriting",
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.first.mockResolvedValue(null);
  mocks.model.mockResolvedValue({ text: "result" });
});
it.each([422, 503])(
  "a moderation denial/failure (%i) never charges or calls the model",
  async (status) => {
    mocks.gate.mockRejectedValue(new HttpError(status, "blocked"));
    await expect(generate(request(), "owner")).rejects.toMatchObject({
      status,
    });
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.model).not.toHaveBeenCalled();
  },
);
it("moderates before the first debit and AI invocation", async () => {
  await expect(generate(request(), "owner")).resolves.toMatchObject({
    output: "result",
  });
  expect(mocks.gate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.batch.mock.invocationCallOrder[0],
  );
  expect(mocks.batch.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.model.mock.invocationCallOrder[0],
  );
});
