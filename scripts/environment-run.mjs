import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  readConfig,
  targetName,
  assertBuiltEnvironment,
} from "./environments.mjs";
export function commandPlan(action, target) {
  const normalized = targetName(target);
  const wrangler = "node_modules/wrangler/bin/wrangler.js";
  const preflight = ["node", "scripts/preflight.mjs", "--env", normalized];
  const migrate = [
    "node",
    wrangler,
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
    "--config",
    "wrangler.jsonc",
    "--env",
    normalized,
  ];
  if (action === "build")
    return [
      ["node", "node_modules/vite/bin/vite.js", "build"],
      ["verify-build"],
      ["node", "scripts/check-boundaries.mjs"],
    ];
  if (action === "migrate") return [preflight, migrate];
  if (action === "deploy")
    return [
      preflight,
      ["npm", "run", "check"],
      ["verify-build"],
      migrate,
      ["node", wrangler, "deploy", "--config", "dist/server/wrangler.json"],
    ];
  throw new Error("Choose build, migrate or deploy.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [action, target] = process.argv.slice(2);
    const normalized = targetName(target);
    const commands = commandPlan(action, normalized);
    // Vite selects the Cloudflare environment at BUILD time, not deploy time.
    const env = { ...process.env, CLOUDFLARE_ENV: normalized };
    for (const [bin, ...args] of commands) {
      if (bin === "verify-build") {
        assertBuiltEnvironment(
          readConfig(),
          target,
          JSON.parse(readFileSync("dist/server/wrangler.json", "utf8")),
        );
      } else
        execFileSync(
          bin === "node"
            ? process.execPath
            : process.platform === "win32"
              ? "npm.cmd"
              : "npm",
          args,
          { env, stdio: "inherit" },
        );
    }
  } catch (error) {
    // Child tools already print their diagnostics. Do not print serialized process/env objects.
    console.error(
      error.status
        ? "Environment command failed; deployment stopped."
        : error.message,
    );
    process.exitCode = 1;
  }
}
