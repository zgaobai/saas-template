import "@tanstack/react-start/server-only";
import { randomBytes } from "node:crypto";
/** 128 random bits encoded in 22 URL-safe characters; never truncate existing IDs. */
export function shortId() {
  return randomBytes(16).toString("base64url");
}
