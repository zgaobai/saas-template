import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";
import {
  readConfig,
  selectEnvironment,
  deploymentErrors,
  targetName,
} from "./environments.mjs";
export function inspectConfig(values, requirements, production = false) {
  const present = (key) =>
    typeof values[key] === "string" && values[key].trim().length > 0;
  const errors = [];
  const warnings = [];
  const provider = values.PAYMENT_PROVIDER || "pancake";
  if (!["pancake", "stripe", "creem", "paypal"].includes(provider))
    errors.push("PAYMENT_PROVIDER: unsupported value");
  for (const [key, allowed] of Object.entries({
    APP_ENV: ["development", "staging", "production"],
    AI_API_STYLE: ["responses", "chat"],
    PANCAKE_ENVIRONMENT: ["test", "prod"],
    MODERATION_PROVIDER: ["pancake", "creem", "disabled"],
    CREEM_ENVIRONMENT: ["test", "production"],
    PAYPAL_ENVIRONMENT: ["sandbox", "production"],
  }))
    if (present(key) && !allowed.includes(values[key]))
      errors.push(key + ": unsupported value");
  if (present("BETTER_AUTH_SECRET") && values.BETTER_AUTH_SECRET.length < 32)
    errors.push("BETTER_AUTH_SECRET: requires at least 32 characters");
  if (!present("REDEMPTION_ENCRYPTION_KEY"))
    warnings.push("Code creation disabled: REDEMPTION_ENCRYPTION_KEY missing");
  else if (!/^[a-f0-9]{64}$/i.test(values.REDEMPTION_ENCRYPTION_KEY))
    errors.push("REDEMPTION_ENCRYPTION_KEY: requires 64 hex characters");
  for (const key of Object.keys(values))
    if (/^VITE_.*(KEY|SECRET|TOKEN|PASSWORD)/i.test(key) && present(key))
      errors.push(key + ": credentials must not use a public prefix");
  for (const key of [
    "APP_URL",
    "AI_BASE_URL",
    "PANCAKE_BASE_URL",
    "STRIPE_BASE_URL",
    "CREEM_BASE_URL",
    "PAYPAL_BASE_URL",
  ])
    if (present(key)) {
      try {
        const url = new URL(values[key]);
        const local =
          !production && ["localhost", "127.0.0.1"].includes(url.hostname);
        if (
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          (url.protocol !== "https:" && !(local && url.protocol === "http:"))
        )
          throw new Error();
        if (key === "APP_URL" && url.pathname !== "/") throw new Error();
      } catch {
        errors.push(
          key + ": use a valid HTTPS URL (local development may use HTTP)",
        );
      }
    }
  if (!present("APP_URL")) errors.push("APP_URL: missing");
  const groups = Object.entries(requirements).map(([name, keys]) => {
    const missing = keys.filter((key) => !present(key));
    const started = keys.some(present);
    const required = name === "auth" || (production && name === "email");
    if (missing.length && (started || required))
      (required ? errors : warnings).push(
        name + ": missing " + missing.join(", "),
      );
    return { name, ready: missing.length === 0, missing };
  });
  const selected = groups.find((g) => g.name === provider);
  if (!selected?.ready)
    warnings.push(
      "Checkout disabled: selected provider " + provider + " is incomplete",
    );
  const moderation = values.MODERATION_PROVIDER || "pancake";
  if (production && moderation === "disabled")
    errors.push("MODERATION_PROVIDER: disabled is only allowed in development");
  if (groups.find((g) => g.name === "ai")?.ready && moderation !== "disabled") {
    const keys =
      moderation === "pancake"
        ? ["PANCAKE_MERCHANT_ID", "PANCAKE_PRIVATE_KEY"]
        : moderation === "creem"
          ? ["CREEM_API_KEY"]
          : [];
    const missing = keys.filter((key) => !present(key));
    if (missing.length)
      (production ? errors : warnings).push(
        "AI generation blocked: moderation missing " + missing.join(", "),
      );
  }
  if (production) {
    if (!["staging", "production"].includes(values.APP_ENV))
      errors.push("APP_ENV: staging or production required");
    for (const [name, key, live] of [
      ["pancake", "PANCAKE_ENVIRONMENT", "prod"],
      ["creem", "CREEM_ENVIRONMENT", "production"],
      ["paypal", "PAYPAL_ENVIRONMENT", "production"],
    ])
      if (
        values.APP_ENV === "production" &&
        provider === name &&
        selected?.ready &&
        values[key] !== live
      )
        warnings.push(key + ": currently using test/sandbox payments");
    if (
      values.APP_ENV === "production" &&
      provider === "stripe" &&
      values.STRIPE_SECRET_KEY?.startsWith("sk_test_")
    )
      warnings.push("Stripe is using a test key");
  }
  if (
    values.APP_ENV === "staging" &&
    values.STRIPE_SECRET_KEY?.startsWith("sk_live_")
  )
    errors.push("STRIPE_SECRET_KEY: staging must use a test key");
  return { provider, groups, errors, warnings };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const flag = process.argv.indexOf("--env");
  const target =
    flag >= 0
      ? targetName(process.argv[flag + 1])
      : process.argv.includes("--production")
        ? "production"
        : undefined;
  const production = Boolean(target);
  const source = readConfig();
  const config = selectEnvironment(source, target);
  const targetEnvFile = target ? `.env.${target}` : ".dev.vars";
  const values = {
    ...config.vars,
    ...(existsSync(targetEnvFile)
      ? parseEnv(readFileSync(targetEnvFile, "utf8"))
      : !production && existsSync(".dev.vars")
        ? parseEnv(readFileSync(".dev.vars", "utf8"))
        : {}),
    ...process.env,
  };
  const requirements = JSON.parse(
    readFileSync("src/server/integration-requirements.json", "utf8"),
  );
  const report = inspectConfig(values, requirements, production);
  if (target) report.errors.push(...deploymentErrors(source, target));
  for (const g of report.groups)
    console.log(
      g.name +
        ": " +
        (g.ready
          ? "configured (not connectivity tested)"
          : "missing " + g.missing.join(", ")),
    );
  for (const warning of report.warnings) console.warn(warning);
  for (const error of report.errors) console.error(error);
  if (report.errors.length) process.exitCode = 1;
  console.log(
    "Only setting names and status are reported; no values are printed. D1/R2 require resource bindings.",
  );
}
