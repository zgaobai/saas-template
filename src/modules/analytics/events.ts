import { getStoredAttribution } from "@/modules/attribution/client";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

/**
 * Low-level universal event dispatcher supporting both GA4 (gtag) and Umami
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  try {
    // 1. Google Analytics (GA4)
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...params });
    }

    // 2. Umami Analytics
    if (typeof window.umami?.track === "function") {
      window.umami.track(name, params);
    }
  } catch {
    // Non-blocking analytics error
  }
}

/**
 * Step 1: User attempts / triggers AI generation on tool workbench
 */
export function trackToolGenerate(params: {
  toolId: string;
  modality?: string;
  tone?: string;
  promptLength?: number;
}) {
  trackEvent("tool_generate", {
    tool_id: params.toolId,
    modality: params.modality || "text",
    tone: params.tone,
    prompt_length: params.promptLength,
  });
}

/**
 * User opens auth modal (e.g. from workbench, header, or pricing)
 */
export function trackAuthModalOpen(trigger: string) {
  trackEvent("auth_modal_open", { trigger });
}

/**
 * Step 2: User successfully completes registration (GA4 standard: sign_up)
 */
export function trackSignUp(params: { method: "email" | "google" | string }) {
  const attr = getStoredAttribution();
  trackEvent("sign_up", {
    method: params.method,
    channel: attr?.channel || "direct",
    source: attr?.source || "direct",
    campaign: attr?.campaign || undefined,
  });
}

/**
 * User logs in (GA4 standard: login)
 */
export function trackLogin(params: { method: "email" | "google" | string }) {
  trackEvent("login", {
    method: params.method,
  });
}

/**
 * Step 3: User views pricing plans (GA4 standard: view_item_list)
 */
export function trackViewPricing(source = "navigation") {
  trackEvent("view_item_list", {
    item_list_name: "Pricing Plans",
    source,
  });
}

/**
 * User selects a specific plan (GA4 standard: select_item)
 */
export function trackSelectPlan(params: {
  planId: string;
  planName: string;
  interval?: string;
  priceCents: number;
}) {
  const price = params.priceCents / 100;
  trackEvent("select_item", {
    item_list_name: "Pricing Plans",
    items: [
      {
        item_id: params.planId,
        item_name: params.planName,
        item_variant: params.interval,
        price,
        quantity: 1,
      },
    ],
  });
}

/**
 * Step 4: User initiates checkout (GA4 standard: begin_checkout)
 */
export function trackBeginCheckout(params: {
  planId: string;
  planName: string;
  interval?: string;
  priceCents: number;
  provider: string;
  currency?: string;
}) {
  const price = params.priceCents / 100;
  const currency = params.currency || "USD";

  trackEvent("begin_checkout", {
    currency,
    value: price,
    payment_type: params.provider,
    items: [
      {
        item_id: params.planId,
        item_name: params.planName,
        item_variant: params.interval,
        price,
        quantity: 1,
      },
    ],
  });
}

/**
 * Step 5: Successful purchase conversion (GA4 standard: purchase)
 * Idempotent: uses localStorage to prevent duplicate firing on page reloads
 */
export function trackPurchase(params: {
  transactionId: string;
  planId?: string;
  planName: string;
  interval?: string;
  amountCents: number;
  currency?: string;
  provider?: string;
}): boolean {
  if (typeof window === "undefined") return false;

  const key = `saas_tracked_purchase_${params.transactionId}`;
  try {
    if (window.localStorage && window.localStorage.getItem(key)) {
      return false; // Already tracked
    }
  } catch {}

  const value = params.amountCents / 100;
  const currency = params.currency || "USD";

  trackEvent("purchase", {
    transaction_id: params.transactionId,
    value,
    currency,
    payment_type: params.provider,
    items: [
      {
        item_id: params.planId || params.transactionId,
        item_name: params.planName,
        item_variant: params.interval,
        price: value,
        quantity: 1,
      },
    ],
  });

  try {
    window.localStorage?.setItem(key, String(Date.now()));
  } catch {}

  return true;
}

/**
 * User successfully redeems a gift/voucher code
 */
export function trackRedeemCode(codeHint?: string) {
  trackEvent("redeem_code", {
    code_hint: codeHint,
  });
}
