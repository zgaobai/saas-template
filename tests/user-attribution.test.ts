import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  userId: "admin-user" as string | null,
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/server/env", () => ({
  bindings: () => state.env,
  paymentConfigured: () => false,
  publicCapabilities: () => ({ ai: false }),
}));

import {
  detectChannel,
  formatChannel,
} from "@/modules/attribution/client";
import {
  parseAttributionFromCookie,
  recordUserAttribution,
  getUserAttribution,
  getChannelStats,
} from "@/modules/attribution/server/service";

let db: DatabaseSync;

function statement(sql: string, args: any[] = []): any {
  return {
    bind: (...bindArgs: any[]) => statement(sql, bindArgs),
    first: async () => {
      return db.prepare(sql).get(...args) ?? null;
    },
    all: async () => {
      const rows = db.prepare(sql).all(...args);
      return { results: rows };
    },
    run: async () => {
      const res = db.prepare(sql).run(...args);
      return { meta: { changes: res.changes } };
    },
  };
}

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=OFF");

  const files = readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  }

  db.prepare(`
    INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
    VALUES ('u1', 'Alice', 'alice@test.com', 1, 1700000000000, 1700000000000)
  `).run();

  db.prepare(`
    INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
    VALUES ('u2', 'Bob', 'bob@test.com', 1, 1700001000000, 1700001000000)
  `).run();

  state.env = {
    DB: {
      prepare: statement,
      batch: async (items: any[]) => {
        db.exec("BEGIN");
        try {
          const results = items.map((s: any) => {
            const rows = db.prepare(s.sql).all(...s.args);
            return { results: rows };
          });
          db.exec("COMMIT");
          return results;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
  };
});

describe("User Acquisition Channel Attribution", () => {
  describe("detectChannel logic", () => {
    it("detects paid ads from UTM parameters", () => {
      const r = detectChannel({
        utmSource: "google",
        utmMedium: "cpc",
      });
      expect(r.channel).toBe("google_ads");
      expect(r.source).toBe("google");
    });

    it("detects organic search from referrer hostname", () => {
      const r = detectChannel({
        referrerHost: "www.google.com",
      });
      expect(r.channel).toBe("google_organic");
      expect(r.medium).toBe("organic");
    });

    it("detects social platforms from referrer or UTM", () => {
      const fromTwitter = detectChannel({
        referrerHost: "t.co",
      });
      expect(fromTwitter.channel).toBe("twitter");

      const fromGithub = detectChannel({
        utmSource: "github",
        utmMedium: "readme",
      });
      expect(fromGithub.channel).toBe("github");
    });

    it("detects affiliate/invite codes", () => {
      const r = detectChannel({
        refCode: "partner_vip",
      });
      expect(r.channel).toBe("affiliate");
      expect(r.source).toBe("partner_vip");
    });

    it("defaults to direct when no UTM or referrer is present", () => {
      const r = detectChannel({});
      expect(r.channel).toBe("direct");
      expect(r.source).toBe("direct");
    });
  });

  describe("Cookie parsing", () => {
    it("parses valid saas_attr cookie", () => {
      const payload = {
        channel: "google_ads",
        source: "google",
        campaign: "summer_sale",
        capturedAt: 1700000000000,
      };
      const cookieHeader = `other=123; saas_attr=${encodeURIComponent(JSON.stringify(payload))}; foo=bar`;
      const result = parseAttributionFromCookie(cookieHeader);
      expect(result).toBeDefined();
      expect(result?.channel).toBe("google_ads");
      expect(result?.campaign).toBe("summer_sale");
    });

    it("handles missing or malformed cookie safely", () => {
      expect(parseAttributionFromCookie(null)).toBeNull();
      expect(parseAttributionFromCookie("")).toBeNull();
      expect(parseAttributionFromCookie("saas_attr=invalid_json")).toBeNull();
    });
  });

  describe("Database attribution persistence", () => {
    it("records user attribution and preserves first-touch on subsequent calls", async () => {
      await recordUserAttribution("u1", {
        channel: "google_organic",
        source: "www.google.com",
        medium: "organic",
        landingPath: "/zh/tools/chat",
        referrerUrl: "https://www.google.com/search?q=saas",
      });

      const record = await getUserAttribution("u1");
      expect(record).toBeDefined();
      expect(record?.channel).toBe("google_organic");
      expect(record?.landing_path).toBe("/zh/tools/chat");
      expect(record?.referrer_url).toBe("https://www.google.com/search?q=saas");

      // Attempt to overwrite with different source - must preserve first touch
      await recordUserAttribution("u1", {
        channel: "twitter",
        source: "twitter.com",
      });

      const unchanged = await getUserAttribution("u1");
      expect(unchanged?.channel).toBe("google_organic");
    });

    it("aggregates channel statistics", async () => {
      await recordUserAttribution("u1", { channel: "google_organic" });
      await recordUserAttribution("u2", { channel: "google_organic" });

      const stats = await getChannelStats(0, Date.now() + 100000);
      expect(stats.length).toBeGreaterThan(0);
      const google = stats.find((s) => s.channel === "google_organic");
      expect(google).toBeDefined();
      expect(google?.count).toBe(2);
    });
  });

  describe("formatChannel human-readable formatting", () => {
    it("formats known channels properly", () => {
      expect(formatChannel("direct")).toBe("直接访问");
      expect(formatChannel("google_organic")).toBe("Google 搜索");
      expect(formatChannel("google_ads")).toBe("Google 广告");
      expect(formatChannel("affiliate", "alex123")).toBe("推广邀请: alex123");
      expect(formatChannel("referral", "producthunt.com")).toBe("外部引荐: producthunt.com");
    });
  });
});
