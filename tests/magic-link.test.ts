import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("cloudflare:workers", () => ({
  env: {
    APP_ENV: "development",
    APP_URL: "http://127.0.0.1:4317",
    BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  },
}));

describe("magic link client and dev-link foundation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports authClient with magicLink signIn method", async () => {
    const { authClient } = await import("@/modules/auth/client");
    expect(typeof authClient.signIn.magicLink).toBe("function");
  });

  it("records and retrieves dev magic links in development mode", async () => {
    const { recordDevMagicLink, getLatestDevMagicLink } = await import(
      "@/modules/auth/server/dev-link"
    );

    const email = "test-user@example.com";
    const testUrl = "http://127.0.0.1:4317/api/auth/magic-link/verify?token=sample-token";

    recordDevMagicLink(email, testUrl);
    expect(getLatestDevMagicLink(email)).toBe(testUrl);
    expect(getLatestDevMagicLink("TEST-USER@EXAMPLE.COM")).toBe(testUrl);
    expect(getLatestDevMagicLink("other@example.com")).toBeNull();
  });

  it("includes magicLink plugin in server betterAuth configuration", async () => {
    const { betterAuth } = await import("better-auth");
    const { magicLink } = await import("better-auth/plugins");

    const authInstance = betterAuth({
      secret: "01234567890123456789012345678901",
      baseURL: "http://localhost:4317",
      plugins: [
        magicLink({
          sendMagicLink: async () => {},
        }),
      ],
    });

    expect(authInstance.options.plugins).toBeDefined();
    const hasMagicLink = authInstance.options.plugins?.some(
      (p: { id?: string }) => p.id === "magic-link",
    );
    expect(hasMagicLink).toBe(true);
  });
});
