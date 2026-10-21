import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";

let dynamicGoogleClientId = "";

export function setClientGoogleClientId(id: string): void {
  dynamicGoogleClientId = id;
}

export function getClientGoogleClientId(): string {
  return dynamicGoogleClientId;
}

export const authClient = createAuthClient({
  plugins: [
    oneTapClient({
      get clientId() {
        return dynamicGoogleClientId;
      },
    }),
  ],
});

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

let clientSessionCache: { user: SessionUser; expiresAt: number } | null = null;
const SESSION_CACHE_TTL = 60_000; // 60 seconds

export function getCachedClientSession(): SessionUser | null {
  if (typeof window === "undefined" || !clientSessionCache) return null;
  if (Date.now() > clientSessionCache.expiresAt) {
    clientSessionCache = null;
    return null;
  }
  return clientSessionCache.user;
}

export function setCachedClientSession(user: SessionUser | null): void {
  if (typeof window === "undefined") return;
  clientSessionCache = user
    ? { user, expiresAt: Date.now() + SESSION_CACHE_TTL }
    : null;
}

export function clearClientSessionCache(): void {
  if (typeof window !== "undefined") {
    clientSessionCache = null;
  }
}

