import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/modules/auth/server/auth", () => ({ auth: () => ({ api: mocks }) }));
vi.mock("@/server/env", () => ({
  publicCapabilities: () => ({ email: false }),
}));
vi.mock("@/server/db/client", () => ({
  db: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
  }),
}));
import { readAccountSecurity } from "@/modules/auth/server/security";

const headers = new Headers({ cookie: "test-cookie" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "owner", emailVerified: true },
    session: { id: "current", token: "current-secret" },
  });
  mocks.limit.mockResolvedValue([]);
});
describe("account security boundary", () => {
  it("requires authentication before reading account flags", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(readAccountSecurity(headers)).rejects.toThrow("请先登录");
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("distinguishes OAuth-only accounts from password accounts without returning credentials", async () => {
    expect(await readAccountSecurity(headers)).toEqual({
      hasPassword: false,
      emailVerified: true,
      emailReady: false,
    });
    mocks.limit.mockResolvedValue([{ id: "credential-account" }]);
    expect(await readAccountSecurity(headers)).toEqual({
      hasPassword: true,
      emailVerified: true,
      emailReady: false,
    });
  });
});
