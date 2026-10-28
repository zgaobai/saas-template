import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import type {
  AttributionPayload,
  UserAttributionRecord,
  ChannelStat,
} from "../types";

const ATTR_COOKIE_NAME = "saas_attr";

/**
 * Extract attribution payload from cookie header
 */
export function parseAttributionFromCookie(
  cookieHeader: string | null | undefined,
): AttributionPayload | null {
  if (!cookieHeader) return null;

  try {
    const cookies = cookieHeader.split(";");
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.trim().split("=");
      if (name === ATTR_COOKIE_NAME) {
        const value = rest.join("=");
        if (value) {
          const decoded = decodeURIComponent(value);
          return JSON.parse(decoded) as AttributionPayload;
        }
      }
    }
  } catch {
    // Malformed cookie
  }
  return null;
}

/**
 * Record user attribution in database.
 * If user already has attribution recorded, this operation is a no-op (preserves first-touch attribution).
 */
export async function recordUserAttribution(
  userId: string,
  payload?: Partial<AttributionPayload> | null,
): Promise<void> {
  if (!userId) return;

  const db = bindings().DB;
  if (!db) return;

  const id = crypto.randomUUID();
  const now = Date.now();
  const channel = payload?.channel?.trim() || "direct";
  const source = payload?.source?.trim() || null;
  const medium = payload?.medium?.trim() || null;
  const campaign = payload?.campaign?.trim() || null;
  const content = payload?.content?.trim() || null;
  const term = payload?.term?.trim() || null;
  const refCode = payload?.refCode?.trim() || null;
  const landingPath = payload?.landingPath?.slice(0, 300) || null;
  const referrerUrl = payload?.referrerUrl?.slice(0, 500) || null;

  try {
    await db
      .prepare(
        `INSERT INTO user_attributions (
          id, user_id, channel, source, medium, campaign, content, term, ref_code, landing_path, referrer_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO NOTHING`,
      )
      .bind(
        id,
        userId,
        channel,
        source,
        medium,
        campaign,
        content,
        term,
        refCode,
        landingPath,
        referrerUrl,
        now,
      )
      .run();
  } catch {
    // Safe failure if database is down or table does not exist
  }
}

/**
 * Fetch attribution details for a specific user
 */
export async function getUserAttribution(
  userId: string,
): Promise<UserAttributionRecord | null> {
  const db = bindings().DB;
  if (!db || !userId) return null;

  try {
    const row = await db
      .prepare(
        `SELECT id, user_id, channel, source, medium, campaign, content, term, ref_code, landing_path, referrer_url, created_at
         FROM user_attributions WHERE user_id = ?`,
      )
      .bind(userId)
      .first<UserAttributionRecord>();
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Aggregate channel statistics over a timeframe
 */
export async function getChannelStats(
  from: number,
  until: number,
): Promise<ChannelStat[]> {
  const db = bindings().DB;
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT
          COALESCE(NULLIF(channel, ''), 'direct') AS channel,
          COUNT(*) AS count
         FROM user_attributions
         WHERE created_at >= ? AND created_at <= ?
         GROUP BY channel
         ORDER BY count DESC
         LIMIT 10`,
      )
      .bind(from, until)
      .all<ChannelStat>();
    return results || [];
  } catch {
    return [];
  }
}
