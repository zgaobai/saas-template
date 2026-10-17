import { it, expect } from "vitest";
import requirements from "@/server/integration-requirements.json";
// @ts-expect-error JS CLI module deliberately shared without a runtime dependency.
import { inspectConfig } from "../scripts/check-config.mjs";
it("configuration diagnostics report setting names without secret values", () => {
  const secret = "super-secret-value-not-for-output";
  const result = inspectConfig(
    {
      APP_URL: "http://127.0.0.1:4317",
      APP_ENV: "development",
      BETTER_AUTH_SECRET: secret,
      STRIPE_SECRET_KEY: secret,
      PAYMENT_PROVIDER: "stripe",
    },
    requirements,
  );
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(result.groups.find((g: any) => g.name === "stripe").missing).toContain(
    "STRIPE_WEBHOOK_SECRET",
  );
});
it("production requires email and authentication and rejects public secret variables", () => {
  const r = inspectConfig(
    {
      APP_URL: "https://example.test",
      APP_ENV: "production",
      VITE_API_KEY: "hidden",
    },
    requirements,
    true,
  );
  expect(r.errors.join(" ")).toContain("RESEND_API_KEY");
  expect(r.errors.join(" ")).toContain("BETTER_AUTH_SECRET");
  expect(r.errors.join(" ")).toContain("VITE_API_KEY");
  expect(JSON.stringify(r)).not.toContain("hidden");
});
it("rejects unsupported providers and credentials embedded in service URLs", () => {
  const r = inspectConfig(
    {
      APP_URL: "https://example.test",
      PAYMENT_PROVIDER: "typo",
      AI_BASE_URL: "https://user:password@example.test/v1",
    },
    requirements,
  );
  expect(r.errors.join(" ")).toContain("PAYMENT_PROVIDER");
  expect(r.errors.join(" ")).toContain("AI_BASE_URL");
  expect(JSON.stringify(r)).not.toContain("password");
});
it("selects Pancake by default and rejects the removed merchant adapter", () => {
  const defaults = inspectConfig({ APP_URL: "https://app.test" }, requirements);
  expect(defaults.provider).toBe("pancake");
  expect(
    defaults.groups.find((g: any) => g.name === "pancake").missing,
  ).toContain("PANCAKE_PRIVATE_KEY");
  expect(defaults.groups.some((g: any) => g.name === "waffo")).toBe(false);
  const legacy = inspectConfig(
    { APP_URL: "https://app.test", PAYMENT_PROVIDER: "waffo" },
    requirements,
  );
  expect(legacy.errors.join(" ")).toContain("PAYMENT_PROVIDER");
});
it("detects missing moderation credentials and a production bypass", () => {
  const r = inspectConfig(
    {
      APP_URL: "https://app.test",
      APP_ENV: "production",
      OPENAI_API_KEY: "private",
      AI_MODEL: "model",
    },
    requirements,
    true,
  );
  expect(r.errors.join(" ")).toContain("PANCAKE_PRIVATE_KEY");
  const bypass = inspectConfig(
    { APP_URL: "https://app.test", MODERATION_PROVIDER: "disabled" },
    requirements,
    true,
  );
  expect(bypass.errors.join(" ")).toContain("MODERATION_PROVIDER");
});

it("validates the private redemption key without printing it", () => {
  const secret = "never-print-this-invalid-key";
  const invalid = inspectConfig(
    { APP_URL: "http://127.0.0.1:4317", REDEMPTION_ENCRYPTION_KEY: secret },
    requirements,
  );
  expect(invalid.errors.join(" ")).toContain("REDEMPTION_ENCRYPTION_KEY");
  expect(JSON.stringify(invalid)).not.toContain(secret);
  expect(
    inspectConfig(
      {
        APP_URL: "http://127.0.0.1:4317",
        REDEMPTION_ENCRYPTION_KEY: "a".repeat(64),
      },
      requirements,
    ).errors.some((e: string) => e.includes("REDEMPTION_ENCRYPTION_KEY")),
  ).toBe(false);
});

it("validates payment provider base URLs if specified", () => {
  const invalid = inspectConfig(
    {
      APP_URL: "https://app.test",
      PANCAKE_BASE_URL: "ftp://invalid-url.com",
      STRIPE_BASE_URL: "https://user:pass@stripe.custom.com",
      CREEM_BASE_URL: "not-a-url",
      PAYPAL_BASE_URL: "http://insecure-remote.com",
    },
    requirements,
    true,
  );
  expect(invalid.errors.join(" ")).toContain("PANCAKE_BASE_URL");
  expect(invalid.errors.join(" ")).toContain("STRIPE_BASE_URL");
  expect(invalid.errors.join(" ")).toContain("CREEM_BASE_URL");
  expect(invalid.errors.join(" ")).toContain("PAYPAL_BASE_URL");

  const valid = inspectConfig(
    {
      APP_URL: "https://app.test",
      PANCAKE_BASE_URL: "https://proxy.my-waffo.internal",
      STRIPE_BASE_URL: "https://proxy.my-stripe.internal",
      CREEM_BASE_URL: "https://proxy.my-creem.internal",
      PAYPAL_BASE_URL: "https://proxy.my-paypal.internal",
    },
    requirements,
    true,
  );
  expect(valid.errors.some((e: string) => e.includes("BASE_URL"))).toBe(false);
});

