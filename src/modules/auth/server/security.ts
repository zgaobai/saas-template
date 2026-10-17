import "@tanstack/react-start/server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "@/server/db/client";
import { account } from "@/server/db/schema";
import { publicCapabilities } from "@/server/env";

// Return only the capability flags required by account settings.
export async function readAccountSecurity(headers: Headers) {
  const api = auth().api;
  const current = await api.getSession({ headers });
  if (!current) throw new Error("请先登录。");
  const credentials = await db()
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, current.user.id),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    )
    .limit(1);
  return {
    hasPassword: credentials.length > 0,
    emailVerified: current.user.emailVerified,
    emailReady: publicCapabilities().email,
  };
}
