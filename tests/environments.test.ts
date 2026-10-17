import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Shared dependency-free deployment module.
import * as environments from "../scripts/environments.mjs";
const {
  selectEnvironment,
  deploymentErrors,
  privateConfigErrors,
  assertBuiltEnvironment,
} = environments;
// @ts-expect-error Shared dependency-free CLI planner, never executes on import.
import { commandPlan } from "../scripts/environment-run.mjs";
// @ts-expect-error Shared CLI configuration validation.
import { inspectConfig } from "../scripts/check-config.mjs";
import requirements from "@/server/integration-requirements.json";
const config = () => JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
function configured() {
  const c = config();
  c.env.staging.vars.APP_URL = "https://staging.my-product.io";
  c.env.production.vars.APP_URL = "https://my-product.io";
  c.env.staging.d1_databases[0].database_id =
    "11111111-1111-4111-8111-111111111111";
  c.env.production.d1_databases[0].database_id =
    "22222222-2222-4222-8222-222222222222";
  return c;
}
it("keeps local behavior and supplies complete independent named environments", () => {
  const c = config();
  expect(selectEnvironment(c).vars.APP_ENV).toBe("development");
  for (const name of ["staging", "production"]) {
    const target = selectEnvironment(c, name);
    expect(Object.keys(target.vars).sort()).toEqual(Object.keys(c.vars).sort());
    expect(target.vars.APP_ENV).toBe(name);
    expect(target.d1_databases[0].database_name).not.toBe(
      c.d1_databases[0].database_name,
    );
    expect(target.r2_buckets[0].bucket_name).not.toBe(
      c.r2_buckets[0].bucket_name,
    );
  }
  expect(() => selectEnvironment(c, "typo")).toThrow();
});
it.each(["staging", "production"])(
  "prevents publishing placeholders in %s",
  (target) => {
    const errors = deploymentErrors(config(), target).join(" ");
    expect(errors).toContain("APP_URL");
    expect(errors).toContain("database_id");
    expect(deploymentErrors(configured(), target)).toEqual([]);
  },
);
it.each(["worker", "url", "database", "bucket"])(
  "rejects shared staging/production resources: %s",
  (part) => {
    const c = configured(),
      s = c.env.staging,
      p = c.env.production;
    if (part === "worker") s.name = p.name;
    if (part === "url") s.vars.APP_URL = p.vars.APP_URL;
    if (part === "database") s.d1_databases = p.d1_databases;
    if (part === "bucket") s.r2_buckets = p.r2_buckets;
    expect(deploymentErrors(c, "staging").join(" ")).toContain("shared");
  },
);
it("rejects wrong payment mode, wrong APP_ENV and credentials stored in nested vars", () => {
  const c = configured();
  c.env.staging.vars.PANCAKE_ENVIRONMENT = "prod";
  c.env.staging.vars.APP_ENV = "development";
  c.env.production.vars.PANCAKE_PRIVATE_KEY = "sensitive-content";
  expect(deploymentErrors(c, "staging").join(" ")).toContain(
    "PANCAKE_ENVIRONMENT",
  );
  expect(deploymentErrors(c, "staging").join(" ")).toContain("APP_ENV");
  const errors = privateConfigErrors(c).join(" ");
  expect(errors).toContain("PANCAKE_PRIVATE_KEY");
  expect(errors).not.toContain("sensitive-content");
});
it("never inherits missing named bindings from local development", () => {
  const c = configured();
  delete c.env.staging.d1_databases;
  expect(selectEnvironment(c, "staging").d1_databases).toEqual([]);
  expect(deploymentErrors(c, "staging").join(" ")).toContain("database_id");
});
it("binds preflight and remote migration to the requested environment, deploys the verified built config", () => {
  const plan = commandPlan("deploy", "staging");
  expect(plan[0]).toEqual([
    "node",
    "scripts/preflight.mjs",
    "--env",
    "staging",
  ]);
  expect(plan[2]).toEqual(["verify-build"]);
  expect(plan[3].slice(-4)).toEqual([
    "--config",
    "wrangler.jsonc",
    "--env",
    "staging",
  ]);
  expect(plan[4].slice(-3)).toEqual([
    "deploy",
    "--config",
    "dist/server/wrangler.json",
  ]);
  expect(() => commandPlan("deploy", undefined)).toThrow();
});
it("refuses deploying a default or other-environment build", () => {
  const c = configured();
  expect(() =>
    assertBuiltEnvironment(c, "production", selectEnvironment(c, "staging")),
  ).toThrow();
  expect(() =>
    assertBuiltEnvironment(c, "production", selectEnvironment(c, "production")),
  ).not.toThrow();
  const built = structuredClone(selectEnvironment(c, "production"));
  built.d1_databases[0].database_id = c.env.staging.d1_databases[0].database_id;
  expect(() => assertBuiltEnvironment(c, "production", built)).toThrow(
    "d1_databases",
  );
});
it("requires real email and moderation in staging and rejects a known Stripe live key", () => {
  const report = inspectConfig(
    {
      APP_ENV: "staging",
      APP_URL: "https://staging.my-product.io",
      MODERATION_PROVIDER: "disabled",
      STRIPE_SECRET_KEY: "sk_live_private",
    },
    requirements,
    true,
  );
  expect(report.errors.join(" ")).toContain("RESEND_API_KEY");
  expect(report.errors.join(" ")).toContain("MODERATION_PROVIDER");
  expect(report.errors.join(" ")).toContain("staging must use a test key");
  expect(JSON.stringify(report)).not.toContain("sk_live_private");
});

it.each(["staging", "production"])(
  "requires maintenance cron in %s and preserves it in the build",
  (target) => {
    const c = configured();
    const built = structuredClone(selectEnvironment(c, target));
    expect(() => assertBuiltEnvironment(c, target, built)).not.toThrow();
    built.triggers.crons = [];
    expect(() => assertBuiltEnvironment(c, target, built)).toThrow(
      "triggers.crons",
    );
    delete built.triggers;
    expect(() => assertBuiltEnvironment(c, target, built)).toThrow(
      "triggers.crons",
    );
    delete c.env[target].triggers;
    expect(deploymentErrors(c, target).join(" ")).toContain("maintenance cron");
    c.env[target].triggers = { crons: ["*/5 * * * *"] };
    expect(deploymentErrors(c, target).join(" ")).toContain("0 0 * * *");
    c.env[target].triggers = { crons: ["0 0 * * *"] };
    expect(deploymentErrors(c, target).join(" ")).toContain("maintenance cron");
  },
);

// @ts-expect-error Shared sync-env script.
import { syncEnvironmentConfig } from "../scripts/sync-env.mjs";

it("handles absent env file safely with auto option", () => {
  expect(syncEnvironmentConfig("staging", { auto: true })).toBe(false);
  expect(() => syncEnvironmentConfig("invalid" as any)).toThrow();
});

