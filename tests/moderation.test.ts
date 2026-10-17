import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: {} as Record<string, any>,
  api: vi.fn(),
  run: vi.fn(),
  bind: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/server/env", () => ({
  bindings: () => mocks.env,
  required: (value: string) => {
    if (!value) throw new Error();
    return value;
  },
}));
vi.mock("@/modules/integrations/server/pancake", () => ({
  pancakeApi: mocks.api,
}));
import { assertPromptAllowed } from "@/modules/moderation/server/service";
const context = { userId: "owner", requestId: "request_id" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.bind.mockReturnValue({ run: mocks.run });
  mocks.env = {
    MODERATION_PROVIDER: "pancake",
    APP_ENV: "development",
    DB: { prepare: () => ({ bind: mocks.bind }) },
  };
});
afterEach(() => vi.unstubAllGlobals());
it("enforces semantic checks and keeps content out of audit rows", async () => {
  mocks.api.mockResolvedValue({ action: "allow", reasonCode: "allowed" });
  await assertPromptAllowed("private user content", context);
  expect(mocks.api).toHaveBeenCalledWith(
    "/v1/actions/verification/scan-prompt",
    { prompt: "private user content", locale: "zh", semantic: "enforce" },
  );
  expect(JSON.stringify(mocks.bind.mock.calls)).not.toContain(
    "private user content",
  );
  expect(mocks.bind.mock.calls[0]).toContain("moderation:pancake:allow");
});
it.each([
  { action: "block", reasonCode: "restricted_content" },
  { action: "review", reasonCode: "review_required" },
])("rejects content without an explicit allow %j", async (result) => {
  mocks.api.mockResolvedValue(result);
  await expect(
    assertPromptAllowed("review this", context),
  ).rejects.toMatchObject({ status: 422 });
});
it.each([
  { action: "review", reasonCode: "service_degraded" },
  { action: "allow", reasonCode: "service_degraded" },
  {},
  { action: "unknown" },
])("fails closed on degraded or invalid evidence %j", async (result) => {
  mocks.api.mockResolvedValue(result);
  await expect(
    assertPromptAllowed("review this", context),
  ).rejects.toMatchObject({ status: 503 });
});
it("does not expose upstream error bodies", async () => {
  mocks.api.mockRejectedValue(new Error("secret key and private prompt"));
  await expect(assertPromptAllowed("review this", context)).rejects.toThrow(
    "内容审核暂时不可用",
  );
});
it("only permits an explicit development bypass", async () => {
  mocks.env.MODERATION_PROVIDER = "disabled";
  await assertPromptAllowed("local testing", context);
  expect(mocks.api).not.toHaveBeenCalled();
  mocks.env.APP_ENV = "production";
  await expect(
    assertPromptAllowed("local testing", context),
  ).rejects.toMatchObject({ status: 503 });
});
it.each(["allow", "flag", "deny", "unknown"])(
  "supports Creem decisions without tying moderation to checkout: %s",
  async (decision) => {
    mocks.env.MODERATION_PROVIDER = "creem";
    mocks.env.PAYMENT_PROVIDER = "stripe";
    mocks.env.CREEM_API_KEY = "private";
    const fetcher = vi.fn().mockResolvedValue(Response.json({ decision }));
    vi.stubGlobal("fetch", fetcher);
    const result = assertPromptAllowed("check this", context);
    if (decision === "allow") await expect(result).resolves.toBeUndefined();
    else
      await expect(result).rejects.toMatchObject({
        status: decision === "unknown" ? 503 : 422,
      });
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://test-api.creem.io/v1/moderation/prompt",
    );
  },
);
