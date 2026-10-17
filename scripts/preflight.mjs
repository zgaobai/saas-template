import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { inspectConfig } from "./check-config.mjs";
import {
  readConfig,
  selectEnvironment,
  deploymentErrors,
  targetName,
} from "./environments.mjs";
import { syncEnvironmentConfig } from "./sync-env.mjs";
const flag = process.argv.indexOf("--env");
const target = targetName(flag >= 0 ? process.argv[flag + 1] : undefined);
try {
  syncEnvironmentConfig(target, { auto: true });
} catch {
  // Ignore failure in auto-sync (e.g. offline during tests)
}
const source = readConfig();
const config = selectEnvironment(source, target);
const errors = deploymentErrors(source, target);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
// Only names are requested from Cloudflare; never download or print secret values.
// This runs only on an explicitly requested deploy, not ordinary local checks.
let secrets;
try {
  secrets = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "secret",
        "list",
        "--config",
        "wrangler.jsonc",
        "--env",
        target,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  if (!Array.isArray(secrets)) throw new Error();
} catch {
  console.error(
    "Unable to read remote secret names. Authenticate Wrangler and configure this Worker's secrets before deploying.",
  );
  process.exit(1);
}
const values = { ...config.vars };
for (const item of secrets) {
  if (typeof item.name !== "string") continue;
  if (Object.hasOwn(config.vars, item.name)) {
    console.error("Remote secret shadows public configuration: " + item.name);
    process.exit(1);
  }
  values[item.name] = "remote-secret-present-value-is-not-readable";
}
const requirements = JSON.parse(
  readFileSync("src/server/integration-requirements.json", "utf8"),
);
const report = inspectConfig(values, requirements, true);
for (const warning of report.warnings) console.warn(warning);
for (const error of report.errors) console.error(error);
if (report.errors.length) process.exit(1);
console.log(
  "Environment " +
    target +
    ": deployment settings and remote secret names checked. Secret correctness and provider connectivity still require sandbox validation.",
);
