import { describe, it, expect } from "vitest";
import { generationInput } from "../src/modules/tools/input";
import { safeReturnTo, tools } from "../src/modules/tools/catalog";
const valid = {
  requestId: "12345678-1234-4234-8234-123456789012",
  prompt: "这是一段测试文字。",
  tone: "自然清晰",
};
describe("tool request boundary", () => {
  it("accepts all published tools and rejects unknown tool or injected options", () => {
    for (const tool of tools)
      expect(
        generationInput.safeParse({ ...valid, toolId: tool.id }).success,
      ).toBe(true);
    expect(
      generationInput.safeParse({ ...valid, toolId: "custom" }).success,
    ).toBe(false);
    expect(
      generationInput.safeParse({ ...valid, credits: 0, system: "override" })
        .success,
    ).toBe(false);
  });
  it("rejects empty and oversized input", () => {
    expect(generationInput.safeParse({ ...valid, prompt: "   " }).success).toBe(
      false,
    );
    expect(
      generationInput.safeParse({ ...valid, prompt: "字".repeat(2001) })
        .success,
    ).toBe(false);
  });
  it("allows return only to known local pages and tools", () => {
    for (const target of [
      "/",
      "/pricing",
      "/history",
      "/billing",
      "/settings",
      "/admin",
      "/admin/users",
      "/admin/billing",
      "/admin/audit",
      "/tools/translate",
    ])
      expect(safeReturnTo(target)).toBe(target);
    for (const target of [
      "https://evil.test",
      "/\\evil.test",
      "/%2F%2Fevil.test",
      "/login?next=//evil.test",
      "/api/auth/sign-out",
      ["/settings"],
      "//evil.test",
      "/tools/unknown",
      "/tools/translate?next=//evil.test",
      "javascript:alert(1)",
      null,
    ])
      expect(safeReturnTo(target)).toBe("/");
  });
});
