import "@tanstack/react-start/server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
} from "node:crypto";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateCode() {
  return Array.from(
    { length: 6 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
}
function encryptionKey() {
  const key = bindings().REDEMPTION_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new HttpError(503, "请先配置兑换码加密密钥。");
  return Buffer.from(key, "hex");
}
export function encryptCode(code: string, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("redemption-code:" + id));
  const ciphertext = Buffer.concat([
    cipher.update(code, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptCode(value: string, id: string) {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra)
    throw new Error("Invalid code envelope");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from("redemption-code:" + id));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
