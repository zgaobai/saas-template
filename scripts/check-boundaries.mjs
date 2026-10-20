import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { privateConfigErrors } from "./environments.mjs";
const walk = (p) =>
  readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)],
  );
const failures = [];
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
failures.push(...privateConfigErrors(config));
for (const f of walk("src").filter((f) => /\.[tj]sx?$/.test(f))) {
  const text = readFileSync(f, "utf8");
  if (/import\.meta\.env\.VITE_.*(?:SECRET|KEY|TOKEN|PASSWORD)/i.test(text))
    failures.push(f + ": secret in public env");
  if (
    (f.includes("/server/") || f.startsWith("src/server/")) &&
    !f.endsWith("schema.ts") &&
    !/import\s+['"]@tanstack\/react-start\/server-only['"]/.test(text)
  )
    failures.push(f + ": missing server boundary");
}
if (!existsSync("dist/client"))
  throw new Error("Build first; client artifacts are required.");
for (const f of walk("dist/client").filter((f) =>
  /\.(js|html|json|map)$/.test(f),
)) {
  // Better Auth's public client bundles a generic unset env getter, not a credential.
  const text = readFileSync(f, "utf8").replace(
    /get BETTER_AUTH_SECRET\(\)\{return [\w$]+\([`'"]BETTER_AUTH_SECRET[`'"]\)\}/g,
    "",
  );
  if (
    /REDEMPTION_ENCRYPTION_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|CREEM_API_KEY|CREEM_WEBHOOK_SECRET|PAYPAL_CLIENT_SECRET|GOOGLE_CLIENT_SECRET|PANCAKE_PRIVATE_KEY|BETTER_AUTH_SECRET|RESEND_API_KEY|OPENAI_API_KEY|PANCAKE_WEBHOOK_PUBLIC_KEY|ADMIN_USER_IDS|FEISHU_WEBHOOK_URL|FEISHU_WEBHOOK_SECRET|BEGIN (?:RSA )?PRIVATE KEY|@waffo\/pancake-ts/.test(
      text,
    )
  )
    failures.push(f + ": server content found in client");
}
for (const envFile of [".dev.vars", ".env.production", ".env.staging"]) {
  if (existsSync(envFile))
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      if (line.startsWith("#") || !line.includes("=")) continue;
      const value = line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (value.length < 16) continue;
      for (const f of walk("dist/client").filter((f) =>
        /\.(js|html|json)$/.test(f),
      ))
        if (readFileSync(f, "utf8").includes(value))
          failures.push(f + ": secret value found from " + envFile);
    }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Server boundaries and built client secret scan passed.");
