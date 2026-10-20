import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCachedClientSession,
  setCachedClientSession,
  clearClientSessionCache,
  type SessionUser,
} from "@/modules/auth/client";
import { clearResourceCache } from "@/lib/use-resource";

describe("client session caching in browser environment", () => {
  const mockUser: SessionUser = {
    id: "usr_test123",
    name: "Test User",
    email: "test@example.com",
    isAdmin: false,
  };

  beforeEach(() => {
    (globalThis as any).window = {};
    clearClientSessionCache();
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("stores and retrieves session from client memory within TTL", () => {
    expect(getCachedClientSession()).toBeNull();
    setCachedClientSession(mockUser);
    expect(getCachedClientSession()).toEqual(mockUser);
  });

  it("immediately clears session cache when clearClientSessionCache is called", () => {
    setCachedClientSession(mockUser);
    expect(getCachedClientSession()).toEqual(mockUser);
    clearClientSessionCache();
    expect(getCachedClientSession()).toBeNull();
  });

  it("expires cached session once TTL passes", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    setCachedClientSession(mockUser);
    expect(getCachedClientSession()).toEqual(mockUser);

    // Advance time past 60s
    vi.spyOn(Date, "now").mockReturnValue(now + 60_001);
    expect(getCachedClientSession()).toBeNull();

    vi.restoreAllMocks();
  });

  it("strictly enforces SSR safety by bypassing cache when window is undefined", () => {
    delete (globalThis as any).window;
    setCachedClientSession(mockUser);
    expect(getCachedClientSession()).toBeNull();
  });
});

describe("resource SWR cache clearing", () => {
  it("exports clearResourceCache safely without throwing", () => {
    (globalThis as any).window = {};
    expect(() => clearResourceCache()).not.toThrow();
    expect(() => clearResourceCache("/api/app")).not.toThrow();
    delete (globalThis as any).window;
  });
});
