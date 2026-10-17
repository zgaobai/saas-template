import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { targetName, readConfig } from "./environments.mjs";

const WRANGLER_VARS = new Set([
  "APP_URL",
  "APP_ENV",
  "PANCAKE_ENVIRONMENT",
  "CREEM_ENVIRONMENT",
  "PAYPAL_ENVIRONMENT",
  "AI_API_STYLE",
  "MODERATION_PROVIDER",
  "AI_MODEL",
  "PAYMENT_PROVIDER",
  "D1_DATABASE_ID",
  "R2_BUCKET_NAME",
]);

export function syncEnvironmentConfig(target, options = {}) {
  targetName(target);
  const envFile = `.env.${target}`;
  if (!existsSync(envFile)) {
    if (options.auto) {
      return false;
    }
    console.error(
      `未找到配置文件 ${envFile}。\n请先复制 ${envFile}.example 为 ${envFile} 并填入你的配置：\n  cp ${envFile}.example ${envFile}`,
    );
    process.exit(1);
  }

  let raw = readFileSync(envFile, "utf8");
  let parsed = parseEnv(raw);
  let fileUpdated = false;

  // 自动补齐缺失的高强度随机密钥，避免用户手动敲命令生成
  if (!parsed.BETTER_AUTH_SECRET || parsed.BETTER_AUTH_SECRET.trim().length < 32) {
    const generated = randomBytes(48).toString("base64url");
    if (raw.includes("BETTER_AUTH_SECRET=")) {
      raw = raw.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${generated}`);
    } else {
      raw += `\nBETTER_AUTH_SECRET=${generated}\n`;
    }
    fileUpdated = true;
  }
  if (!parsed.REDEMPTION_ENCRYPTION_KEY || !/^[a-f0-9]{64}$/i.test(parsed.REDEMPTION_ENCRYPTION_KEY.trim())) {
    const generated = randomBytes(32).toString("hex");
    if (raw.includes("REDEMPTION_ENCRYPTION_KEY=")) {
      raw = raw.replace(/^REDEMPTION_ENCRYPTION_KEY=.*$/m, `REDEMPTION_ENCRYPTION_KEY=${generated}`);
    } else {
      raw += `\nREDEMPTION_ENCRYPTION_KEY=${generated}\n`;
    }
    fileUpdated = true;
  }

  if (fileUpdated) {
    writeFileSync(envFile, raw, { mode: 0o600 });
    parsed = parseEnv(raw);
  }

  const source = readConfig();
  let jsonModified = false;

  // 1. 同步基础配置至 wrangler.jsonc (APP_URL / D1 database_id 等)
  if (source.env?.[target]) {
    const section = source.env[target];
    section.vars = section.vars || {};

    if (parsed.APP_URL && parsed.APP_URL.trim() && section.vars.APP_URL !== parsed.APP_URL.trim()) {
      section.vars.APP_URL = parsed.APP_URL.trim();
      jsonModified = true;
    }
    if (parsed.PAYMENT_PROVIDER && section.vars.PAYMENT_PROVIDER !== parsed.PAYMENT_PROVIDER.trim()) {
      section.vars.PAYMENT_PROVIDER = parsed.PAYMENT_PROVIDER.trim();
      jsonModified = true;
    }
    if (parsed.AI_MODEL && section.vars.AI_MODEL !== parsed.AI_MODEL.trim()) {
      section.vars.AI_MODEL = parsed.AI_MODEL.trim();
      jsonModified = true;
    }
    if (parsed.D1_DATABASE_ID && section.d1_databases?.[0] && section.d1_databases[0].database_id !== parsed.D1_DATABASE_ID.trim()) {
      section.d1_databases[0].database_id = parsed.D1_DATABASE_ID.trim();
      jsonModified = true;
    }
    if (parsed.R2_BUCKET_NAME && section.r2_buckets?.[0] && section.r2_buckets[0].bucket_name !== parsed.R2_BUCKET_NAME.trim()) {
      section.r2_buckets[0].bucket_name = parsed.R2_BUCKET_NAME.trim();
      jsonModified = true;
    }
  }

  if (jsonModified) {
    writeFileSync("wrangler.jsonc", JSON.stringify(source, null, 2) + "\n", "utf8");
    console.log(`✓ 已根据 ${envFile} 自动同步 wrangler.jsonc 中 ${target} 环境的基础配置。`);
  }

  // 2. 提取需要批量上传到 Cloudflare 的私密密钥
  const secrets = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (WRANGLER_VARS.has(key)) continue;
    if (typeof value === "string" && value.trim().length > 0) {
      secrets[key] = value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
    }
  }

  const secretKeys = Object.keys(secrets);
  if (secretKeys.length === 0) {
    console.log(`提示: ${envFile} 中未检测到需要上传的非空私密密钥。`);
    return true;
  }

  // 3. 调用 wrangler secret bulk 批量上传
  const tempPath = `.env.${target}.bulk.json`;
  try {
    writeFileSync(tempPath, JSON.stringify(secrets), { mode: 0o600 });
    execFileSync(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "secret",
        "bulk",
        tempPath,
        "--config",
        "wrangler.jsonc",
        "--env",
        target,
      ],
      { stdio: "inherit" },
    );
    console.log(`✓ 成功批量同步 ${secretKeys.length} 项密钥至 Cloudflare ${target} 环境 Secrets。`);
  } catch (err) {
    if (options.auto) {
      console.warn(`自动批量同步 Secrets 失败，将继续执行预检检查现有远程密钥。`);
      return false;
    }
    console.error(`批量同步密钥失败，请确保已执行 npx wrangler login 登录。`);
    throw err;
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }

  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = targetName(process.argv[2]);
  const auto = process.argv.includes("--auto");
  syncEnvironmentConfig(target, { auto });
}
