import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  storedAttr: null as any,
}));

vi.mock("@/modules/attribution/client", () => ({
  getStoredAttribution: () => state.storedAttr,
}));

import {
  trackEvent,
  trackToolGenerate,
  trackAuthModalOpen,
  trackSignUp,
  trackLogin,
  trackViewPricing,
  trackSelectPlan,
  trackBeginCheckout,
  trackPurchase,
  trackRedeemCode,
} from "@/modules/analytics/events";

describe("Analytics Funnel & GA4 Event Tracking", () => {
  let gtagSpy: ReturnType<typeof vi.fn>;
  let umamiSpy: ReturnType<typeof vi.fn>;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    umamiSpy = vi.fn();
    localStorageMock = {};

    state.storedAttr = null;

    vi.stubGlobal("window", {
      gtag: gtagSpy,
      umami: { track: umamiSpy },
      localStorage: {
        getItem: (k: string) => localStorageMock[k] ?? null,
        setItem: (k: string, v: string) => {
          localStorageMock[k] = v;
        },
      },
    });
  });

  it("trackEvent dispatches events to both GA4 and Umami", () => {
    trackEvent("custom_event", { foo: "bar" });
    expect(gtagSpy).toHaveBeenCalledWith("event", "custom_event", { foo: "bar" });
    expect(umamiSpy).toHaveBeenCalledWith("custom_event", { foo: "bar" });
  });

  it("trackToolGenerate emits tool generation metrics", () => {
    trackToolGenerate({
      toolId: "chat",
      modality: "text",
      promptLength: 42,
      tone: "professional",
    });

    expect(gtagSpy).toHaveBeenCalledWith(
      "event",
      "tool_generate",
      expect.objectContaining({
        tool_id: "chat",
        modality: "text",
        prompt_length: 42,
        tone: "professional",
      }),
    );
  });

  it("trackAuthModalOpen tracks modal opening trigger", () => {
    trackAuthModalOpen("workbench_generate");
    expect(gtagSpy).toHaveBeenCalledWith("event", "auth_modal_open", {
      trigger: "workbench_generate",
    });
  });

  it("trackSignUp tracks user sign up and incorporates attribution channel", () => {
    state.storedAttr = {
      channel: "ai_perplexity",
      source: "perplexity.ai",
      campaign: "spring_sale",
    };

    trackSignUp({ method: "email" });

    expect(gtagSpy).toHaveBeenCalledWith(
      "event",
      "sign_up",
      expect.objectContaining({
        method: "email",
        channel: "ai_perplexity",
        source: "perplexity.ai",
        campaign: "spring_sale",
      }),
    );
  });

  it("trackLogin tracks user sign in", () => {
    trackLogin({ method: "google" });
    expect(gtagSpy).toHaveBeenCalledWith("event", "login", { method: "google" });
  });

  it("trackViewPricing tracks GA4 view_item_list", () => {
    trackViewPricing("header_nav");
    expect(gtagSpy).toHaveBeenCalledWith("event", "view_item_list", {
      item_list_name: "Pricing Plans",
      source: "header_nav",
    });
  });

  it("trackSelectPlan tracks GA4 select_item with dollar prices", () => {
    trackSelectPlan({
      planId: "creator",
      planName: "Creator Plan",
      interval: "month",
      priceCents: 1900,
    });

    expect(gtagSpy).toHaveBeenCalledWith(
      "event",
      "select_item",
      expect.objectContaining({
        item_list_name: "Pricing Plans",
        items: [
          expect.objectContaining({
            item_id: "creator",
            item_name: "Creator Plan",
            price: 19,
          }),
        ],
      }),
    );
  });

  it("trackBeginCheckout tracks GA4 begin_checkout with line items", () => {
    trackBeginCheckout({
      planId: "pro",
      planName: "Pro Annual",
      interval: "year",
      priceCents: 19900,
      provider: "pancake",
    });

    expect(gtagSpy).toHaveBeenCalledWith(
      "event",
      "begin_checkout",
      expect.objectContaining({
        currency: "USD",
        value: 199,
        payment_type: "pancake",
        items: [
          expect.objectContaining({
            item_id: "pro",
            item_name: "Pro Annual",
            item_variant: "year",
            price: 199,
          }),
        ],
      }),
    );
  });

  it("trackPurchase tracks GA4 purchase with idempotency to avoid duplicates", () => {
    // First call: succeeds and fires purchase event
    const firstTrack = trackPurchase({
      transactionId: "ord_1001",
      planId: "creator",
      planName: "Creator Plan",
      amountCents: 2900,
      currency: "USD",
      provider: "stripe",
    });

    expect(firstTrack).toBe(true);
    expect(gtagSpy).toHaveBeenCalledWith(
      "event",
      "purchase",
      expect.objectContaining({
        transaction_id: "ord_1001",
        value: 29,
        currency: "USD",
        payment_type: "stripe",
        items: [
          expect.objectContaining({
            item_id: "creator",
            item_name: "Creator Plan",
            price: 29,
          }),
        ],
      }),
    );

    // Second call with same transaction ID (e.g. user reloaded page): must be suppressed
    gtagSpy.mockClear();
    const secondTrack = trackPurchase({
      transactionId: "ord_1001",
      planId: "creator",
      planName: "Creator Plan",
      amountCents: 2900,
    });

    expect(secondTrack).toBe(false);
    expect(gtagSpy).not.toHaveBeenCalled();
  });

  it("trackRedeemCode tracks gift voucher redemption", () => {
    trackRedeemCode("VIP2026");
    expect(gtagSpy).toHaveBeenCalledWith("event", "redeem_code", {
      code_hint: "VIP2026",
    });
  });
});
