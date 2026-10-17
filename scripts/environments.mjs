import { readFileSync } from "node:fs";
export const targets = ["staging", "production"];
export function targetName(value) {
  if (!targets.includes(value))
    throw new Error("Choose staging or production explicitly.");
  return value;
}
export const readConfig = () =>
  JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
export function selectEnvironment(config, target) {
  if (!target) return config;
  targetName(target);
  const selected = config.env?.[target];
  if (!selected) throw new Error("Missing environment: " + target);
  // Bindings and vars are deliberately NOT inherited from local development.
  return {
    ...config,
    ...selected,
    env: undefined,
    vars: selected.vars || {},
    triggers: selected.triggers || { crons: [] },
    d1_databases: selected.d1_databases || [],
    r2_buckets: selected.r2_buckets || [],
  };
}
export function privateConfigErrors(config) {
  const errors = [];
  for (const [scope, section] of Object.entries({
    local: config,
    ...config.env,
  }))
    for (const [key, value] of Object.entries(section.vars || {}))
      if (/(?:SECRET|API_KEY|PRIVATE_KEY|PASSWORD|TOKEN)/i.test(key) && value)
        errors.push(scope + ": credential must use Secrets: " + key);
  return errors;
}
export function deploymentErrors(config, target) {
  const selected = selectEnvironment(config, targetName(target));
  const errors = privateConfigErrors(config);
  for (const cron of ["*/5 * * * *", "0 0 * * *"])
    if (
      !Array.isArray(selected.triggers?.crons) ||
      !selected.triggers.crons.includes(cron)
    )
      errors.push(target + ": missing required maintenance cron: " + cron);
  if (selected.vars.APP_ENV !== target)
    errors.push("APP_ENV must match " + target);
  try {
    const u = new URL(selected.vars.APP_URL);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      /(^|\.)(invalid|test|localhost|example\.com|example\.org|example\.net)$/.test(
        u.hostname,
      ) ||
      /^(127\.|0\.|\[?::1\]?$)/.test(u.hostname)
    )
      throw new Error();
  } catch {
    errors.push(target + ": replace APP_URL with the real HTTPS origin");
  }
  const db = selected.d1_databases.find((d) => d.binding === "DB");
  const files = selected.r2_buckets.find((b) => b.binding === "FILES");
  if (
    !db ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
      db.database_id || "",
    ) ||
    /^0+(?:-0+)*$/.test(db.database_id)
  )
    errors.push(target + ": configure the real DB database_id");
  if (!files?.bucket_name) errors.push(target + ": configure the FILES bucket");
  for (const [key, expected] of Object.entries(
    target === "staging"
      ? {
          PANCAKE_ENVIRONMENT: "test",
          CREEM_ENVIRONMENT: "test",
          PAYPAL_ENVIRONMENT: "sandbox",
        }
      : {
          PANCAKE_ENVIRONMENT: "prod",
          CREEM_ENVIRONMENT: "production",
          PAYPAL_ENVIRONMENT: "production",
        },
  ))
    if (selected.vars[key] !== expected)
      errors.push(target + ": incorrect " + key);
  for (const [name, other] of Object.entries({
    local: config,
    ...config.env,
  })) {
    if (name === target) continue;
    if (other.name === selected.name)
      errors.push(target + ": Worker name is shared with " + name);
    if (other.vars?.APP_URL === selected.vars.APP_URL)
      errors.push(target + ": APP_URL is shared with " + name);
    if (
      files &&
      other.r2_buckets?.some((b) => b.bucket_name === files.bucket_name)
    )
      errors.push(target + ": FILES bucket is shared with " + name);
    if (
      db &&
      !/^0+(?:-0+)*$/.test(db.database_id) &&
      other.d1_databases?.some((d) => d.database_id === db.database_id)
    )
      errors.push(target + ": DB is shared with " + name);
  }
  return errors;
}
export function assertBuiltEnvironment(config, target, built) {
  const selected = selectEnvironment(config, target);
  if (
    JSON.stringify([...(built.triggers?.crons || [])].sort()) !==
    JSON.stringify([...(selected.triggers?.crons || [])].sort())
  )
    throw new Error(
      "Built Worker does not match " + target + ": triggers.crons",
    );
  for (const key of ["name", "vars", "d1_databases", "r2_buckets"])
    if (
      key === "name"
        ? built.name !== selected.name
        : key === "vars"
          ? Object.entries(selected.vars).some(
              ([k, v]) => built.vars?.[k] !== v,
            )
          : selected[key].some(
              (binding) =>
                !built[key]?.some(
                  (b) =>
                    b.binding === binding.binding &&
                    (key === "d1_databases"
                      ? b.database_id === binding.database_id
                      : b.bucket_name === binding.bucket_name),
                ),
            )
    )
      throw new Error("Built Worker does not match " + target + ": " + key);
}
