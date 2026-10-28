import { useEffect } from "react";
import type { AttributionPayload } from "./types";
import { api } from "@/lib/api";
import { authClient } from "@/modules/auth/client";

const ATTR_STORAGE_KEY = "saas_attribution";
const ATTR_SYNCED_KEY = "saas_attr_synced_user";
const ATTR_COOKIE_NAME = "saas_attr";

/**
 * Detect the primary channel from UTM params, ref code, or referrer host
 */
export function detectChannel(params: {
  utmSource?: string;
  utmMedium?: string;
  refCode?: string;
  referrerHost?: string;
}): { channel: string; source: string; medium?: string } {
  const { utmSource, utmMedium, refCode, referrerHost } = params;

  if (utmSource) {
    const s = utmSource.toLowerCase().trim();
    const m = utmMedium?.toLowerCase().trim();
    const isPaid = m === "cpc" || m === "ppc" || m === "ads" || m === "paid";

    // AI Search Engines via UTM
    if (s.includes("perplexity")) return { channel: "ai_perplexity", source: s, medium: m || "ai_search" };
    if (s.includes("chatgpt") || s === "openai") return { channel: "ai_chatgpt", source: s, medium: m || "ai_search" };
    if (s.includes("claude") || s.includes("anthropic")) return { channel: "ai_claude", source: s, medium: m || "ai_search" };
    if (s.includes("gemini")) return { channel: "ai_gemini", source: s, medium: m || "ai_search" };
    if (s.includes("grok") || s === "xai") return { channel: "ai_grok", source: s, medium: m || "ai_search" };
    if (s.includes("copilot")) return { channel: "ai_copilot", source: s, medium: m || "ai_search" };
    if (s.includes("deepseek")) return { channel: "ai_deepseek", source: s, medium: m || "ai_search" };
    if (s.includes("kimi") || s.includes("moonshot")) return { channel: "ai_kimi", source: s, medium: m || "ai_search" };
    if (s.includes("felo")) return { channel: "ai_felo", source: s, medium: m || "ai_search" };
    if (s.includes("genspark")) return { channel: "ai_genspark", source: s, medium: m || "ai_search" };
    if (s.includes("metaso")) return { channel: "ai_metaso", source: s, medium: m || "ai_search" };
    if (m === "ai_search" || m === "ai" || m === "geo") return { channel: `ai_${s}`, source: s, medium: m };

    // Traditional search / social / ad platforms
    if (s.includes("google")) return { channel: isPaid ? "google_ads" : "google", source: s, medium: m };
    if (s.includes("twitter") || s === "x") return { channel: isPaid ? "twitter_ads" : "twitter", source: s, medium: m };
    if (s.includes("facebook") || s === "fb" || s.includes("meta")) return { channel: isPaid ? "facebook_ads" : "facebook", source: s, medium: m };
    if (s.includes("youtube")) return { channel: isPaid ? "youtube_ads" : "youtube", source: s, medium: m };
    if (s.includes("bing")) return { channel: isPaid ? "bing_ads" : "bing", source: s, medium: m };
    if (s.includes("reddit")) return { channel: isPaid ? "reddit_ads" : "reddit", source: s, medium: m };
    if (s.includes("github")) return { channel: "github", source: s, medium: m };
    if (s.includes("v2ex")) return { channel: "v2ex", source: s, medium: m };
    if (s.includes("producthunt")) return { channel: "producthunt", source: s, medium: m };

    return { channel: s, source: s, medium: m };
  }

  if (refCode) {
    return { channel: "affiliate", source: refCode };
  }

  if (referrerHost) {
    const host = referrerHost.toLowerCase();

    // AI Search Engines & Chatbot Referrers
    if (host.includes("perplexity.ai")) return { channel: "ai_perplexity", source: host, medium: "ai_search" };
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com") || host.includes("openai.com")) return { channel: "ai_chatgpt", source: host, medium: "ai_search" };
    if (host.includes("claude.ai") || host.includes("anthropic.com")) return { channel: "ai_claude", source: host, medium: "ai_search" };
    if (host.includes("gemini.google.com")) return { channel: "ai_gemini", source: host, medium: "ai_search" };
    if (host.includes("grok.com") || host.includes("x.ai")) return { channel: "ai_grok", source: host, medium: "ai_search" };
    if (host.includes("copilot.microsoft.com")) return { channel: "ai_copilot", source: host, medium: "ai_search" };
    if (host.includes("deepseek.com")) return { channel: "ai_deepseek", source: host, medium: "ai_search" };
    if (host.includes("kimi.ai") || host.includes("kimi.moonshot.cn") || host.includes("moonshot.cn")) return { channel: "ai_kimi", source: host, medium: "ai_search" };
    if (host.includes("felo.ai")) return { channel: "ai_felo", source: host, medium: "ai_search" };
    if (host.includes("genspark.ai")) return { channel: "ai_genspark", source: host, medium: "ai_search" };
    if (host.includes("metaso.cn")) return { channel: "ai_metaso", source: host, medium: "ai_search" };
    if (host.includes("you.com")) return { channel: "ai_you", source: host, medium: "ai_search" };
    if (host.includes("phind.com")) return { channel: "ai_phind", source: host, medium: "ai_search" };

    // Traditional search engines
    if (host.includes("google.")) return { channel: "google_organic", source: host, medium: "organic" };
    if (host.includes("bing.")) return { channel: "bing_organic", source: host, medium: "organic" };
    if (host.includes("baidu.")) return { channel: "baidu_organic", source: host, medium: "organic" };
    if (host.includes("yahoo.")) return { channel: "yahoo_organic", source: host, medium: "organic" };
    if (host.includes("duckduckgo.")) return { channel: "duckduckgo_organic", source: host, medium: "organic" };

    // Social & developer platforms
    if (host.includes("t.co") || host.includes("twitter.com") || host.includes("x.com")) return { channel: "twitter", source: host, medium: "social" };
    if (host.includes("youtube.com") || host.includes("youtu.be")) return { channel: "youtube", source: host, medium: "social" };
    if (host.includes("facebook.com")) return { channel: "facebook", source: host, medium: "social" };
    if (host.includes("reddit.com")) return { channel: "reddit", source: host, medium: "social" };
    if (host.includes("github.com")) return { channel: "github", source: host, medium: "social" };
    if (host.includes("v2ex.com")) return { channel: "v2ex", source: host, medium: "referral" };
    if (host.includes("producthunt.com")) return { channel: "producthunt", source: host, medium: "referral" };

    return { channel: "referral", source: host, medium: "referral" };
  }

  return { channel: "direct", source: "direct", medium: "none" };
}

/**
 * Capture initial touch attribution on the client
 */
export function captureAttribution(): AttributionPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const existingRaw = localStorage.getItem(ATTR_STORAGE_KEY);
    // If already captured, maintain first-touch attribution
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw) as AttributionPayload;
        // Keep cookie fresh
        writeAttributionCookie(parsed);
        return parsed;
      } catch {
        // Corrupted, re-capture
      }
    }

    const url = new URL(window.location.href);
    const sp = url.searchParams;

    const utmSource = sp.get("utm_source") || undefined;
    const utmMedium = sp.get("utm_medium") || undefined;
    const utmCampaign = sp.get("utm_campaign") || undefined;
    const utmContent = sp.get("utm_content") || undefined;
    const utmTerm = sp.get("utm_term") || undefined;
    const refCode = sp.get("ref") || sp.get("channel") || sp.get("invite") || undefined;

    let referrerHost: string | undefined;
    let referrerUrl: string | undefined;

    if (document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        // Only treat as external referrer if hostname is different
        if (refUrl.hostname !== window.location.hostname) {
          referrerHost = refUrl.hostname;
          referrerUrl = document.referrer.slice(0, 500);
        }
      } catch {
        // Ignore invalid referrer URL
      }
    }

    const { channel, source, medium } = detectChannel({
      utmSource,
      utmMedium,
      refCode,
      referrerHost,
    });

    const payload: AttributionPayload = {
      channel,
      source,
      medium,
      campaign: utmCampaign,
      content: utmContent,
      term: utmTerm,
      refCode,
      landingPath: (window.location.pathname + window.location.search).slice(0, 300),
      referrerUrl,
      capturedAt: Date.now(),
    };

    localStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(payload));
    writeAttributionCookie(payload);

    return payload;
  } catch {
    return null;
  }
}

function writeAttributionCookie(payload: AttributionPayload) {
  try {
    const serialized = encodeURIComponent(JSON.stringify(payload));
    // Set 30 days cookie
    document.cookie = `${ATTR_COOKIE_NAME}=${serialized}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    // Ignore cookie write errors
  }
}

export function getStoredAttribution(): AttributionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ATTR_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AttributionPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Sync captured attribution to the server when an authenticated session is active
 */
export async function syncAttributionIfLoggedIn(userId: string): Promise<void> {
  if (typeof window === "undefined" || !userId) return;

  try {
    const syncedUser = localStorage.getItem(ATTR_SYNCED_KEY);
    if (syncedUser === userId) {
      return; // Already synced for this user
    }

    const payload = getStoredAttribution();
    if (!payload) return;

    await api("/api/app/attribution", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    localStorage.setItem(ATTR_SYNCED_KEY, userId);
  } catch {
    // Non-blocking sync error
  }
}

/**
 * Format channel identifier to human readable string
 */
export function formatChannel(
  channel?: string | null,
  source?: string | null,
  tr?: (key: string) => string,
): string {
  const t = tr || ((s: string) => s);
  if (!channel) return t("直接访问");

  switch (channel) {
    case "direct":
      return t("直接访问");
    case "ai_perplexity":
      return `✨ ${t("Perplexity AI 搜索")}`;
    case "ai_chatgpt":
      return `✨ ${t("ChatGPT 引用")}`;
    case "ai_claude":
      return `✨ ${t("Claude AI 引用")}`;
    case "ai_gemini":
      return `✨ ${t("Gemini AI 搜索")}`;
    case "ai_grok":
      return `✨ ${t("Grok AI 搜索")}`;
    case "ai_copilot":
      return `✨ ${t("Copilot AI 搜索")}`;
    case "ai_deepseek":
      return `✨ ${t("DeepSeek AI 搜索")}`;
    case "ai_kimi":
      return `✨ ${t("Kimi AI 搜索")}`;
    case "ai_felo":
      return `✨ ${t("Felo AI 搜索")}`;
    case "ai_genspark":
      return `✨ ${t("Genspark AI 搜索")}`;
    case "ai_metaso":
      return `✨ ${t("秘塔 AI 搜索")}`;
    case "ai_you":
      return `✨ ${t("You.com AI 搜索")}`;
    case "ai_phind":
      return `✨ ${t("Phind AI 搜索")}`;
    case "google_organic":
      return t("Google 搜索");
    case "google_ads":
      return t("Google 广告");
    case "google":
      return "Google";
    case "bing_organic":
      return t("Bing 搜索");
    case "bing_ads":
      return t("Bing 广告");
    case "baidu_organic":
      return t("百度搜索");
    case "twitter":
    case "x":
      return "X (Twitter)";
    case "twitter_ads":
      return "X (Twitter) 广告";
    case "youtube":
      return "YouTube";
    case "youtube_ads":
      return "YouTube 广告";
    case "facebook":
      return "Facebook";
    case "facebook_ads":
      return "Facebook 广告";
    case "reddit":
      return "Reddit";
    case "github":
      return "GitHub";
    case "v2ex":
      return "V2EX";
    case "producthunt":
      return "Product Hunt";
    case "affiliate":
      return source ? `${t("推广邀请")}: ${source}` : t("推广邀请");
    case "referral":
      return source ? `${t("外部引荐")}: ${source}` : t("外部引荐");
    default:
      return source || channel;
  }
}

/**
 * Returns true if the channel belongs to generative AI or AI search engine
 */
export function isAiSearchChannel(channel?: string | null): boolean {
  return Boolean(channel && channel.startsWith("ai_"));
}

/**
 * Client component mounted at root to handle first-touch capture and post-login sync
 */
export function AttributionTracker() {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      void syncAttributionIfLoggedIn(session.user.id);
    }
  }, [session?.user?.id]);

  return null;
}

