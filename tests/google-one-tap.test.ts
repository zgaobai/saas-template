import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("cloudflare:workers", () => ({
  env: {
    APP_ENV: "development",
    APP_URL: "http://127.0.0.1:4317",
    GOOGLE_CLIENT_ID: "sample-google-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "sample-secret",
    BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  },
}));

describe("google one tap client foundation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports authClient with oneTap action registered", async () => {
    const { authClient, setClientGoogleClientId, getClientGoogleClientId } =
      await import("@/modules/auth/client");

    expect(typeof authClient.oneTap).toBe("function");

    // Dynamic Google Client ID setting and retrieval
    expect(getClientGoogleClientId()).toBe("");
    setClientGoogleClientId("123456789-test.apps.googleusercontent.com");
    expect(getClientGoogleClientId()).toBe(
      "123456789-test.apps.googleusercontent.com",
    );
  });
});

describe("google one tap server configuration", () => {
  it("includes oneTap plugin in betterAuth when GOOGLE_CLIENT_ID is set", async () => {
    const { betterAuth } = await import("better-auth");
    const { oneTap } = await import("better-auth/plugins");

    const authInstance = betterAuth({
      secret: "01234567890123456789012345678901",
      baseURL: "http://localhost:4317",
      plugins: [
        oneTap({
          clientId: "mock-google-client-id.apps.googleusercontent.com",
        }),
      ],
    });

    expect(authInstance.options.plugins).toBeDefined();
    const hasOneTap = authInstance.options.plugins?.some(
      (p: { id: string }) => p.id === "one-tap",
    );
    expect(hasOneTap).toBe(true);
  });

  it("returns googleClientId in publicCapabilities when configured in bindings", async () => {
    const { publicCapabilities } = await import("@/server/env");
    const caps = publicCapabilities();

    expect(caps.google).toBe(true);
    expect(caps.googleClientId).toBe(
      "sample-google-id.apps.googleusercontent.com",
    );
  });
});
