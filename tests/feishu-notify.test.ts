import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("cloudflare:workers", () => {
  const env: Record<string, unknown> = {
    APP_URL: "https://example.com",
    DB: {
      prepare: () => ({
        bind: () => ({
          first: vi
            .fn()
            .mockResolvedValue({
              email: "test@example.com",
              created_at: 1729420000000,
            }),
        }),
      }),
      batch: vi.fn().mockResolvedValue([
        { results: [{ email: "test@example.com", created_at: 1729420000000 }] },
        { results: [{ total: 6800 }] },
      ]),
    },
  };
  return { env };
});
import { env } from "cloudflare:workers";
import {
  maskEmail,
  getProviderLabel,
  formatCurrency,
  signFeishuWebhook,
  buildFeishuCard,
  buildFeishuWebhookErrorCard,
  buildFeishuSubscriptionPastDueCard,
  notifyFeishuPayment,
  notifyFeishuWebhookError,
  notifyFeishuSubscriptionPastDue,
} from "@/modules/billing/server/feishu-notify";

describe("feishu notification formatting helpers", () => {
  it("masks user email properly to balance identification and privacy", () => {
    expect(maskEmail("3298492@qq.com")).toBe("329****@qq.com");
    expect(maskEmail("alexander@gmail.com")).toBe("ale****@gmail.com");
    expect(maskEmail("hi@test.com")).toBe("hi***@test.com");
    expect(maskEmail("invalid-email")).toBe("invalid-email");
  });

  it("maps internal provider ids to user-friendly display labels", () => {
    expect(getProviderLabel("pancake")).toBe("Waffo Pancake");
    expect(getProviderLabel("stripe")).toBe("Stripe");
    expect(getProviderLabel("creem")).toBe("Creem");
    expect(getProviderLabel("paypal")).toBe("PayPal");
    expect(getProviderLabel("custom")).toBe("custom");
  });

  it("formats currency with matching symbols and two decimal places", () => {
    expect(formatCurrency(5800, "CNY")).toBe("¥58.00");
    expect(formatCurrency(1990, "USD")).toBe("$19.90");
    expect(formatCurrency(1500, "EUR")).toBe("€15.00");
    expect(formatCurrency(2500, "GBP")).toBe("£25.00");
  });

  it("computes deterministic HMAC-SHA256 signature for Feishu webhook", async () => {
    const timestamp = "1729420000";
    const secret = "test_secret";
    const sign = await signFeishuWebhook(timestamp, secret);
    expect(typeof sign).toBe("string");
    expect(sign.length).toBeGreaterThan(10);
    // Identical input produces identical base64 signature
    expect(await signFeishuWebhook(timestamp, secret)).toBe(sign);
  });
});

describe("feishu interactive card structure", () => {
  it("builds the exact card format matching payment arrival screenshot", () => {
    const card = buildFeishuCard({
      amount: 5800,
      currency: "CNY",
      cumulativeAmount: 6800,
      credits: 58000,
      provider: "pancake",
      email: "3298492@qq.com",
      registeredAt: 1722758722000,
      paidAt: 1729421685000,
    });

    expect(card.msg_type).toBe("interactive");
    expect(card.card.header.title.content).toBe("💰 新订单支付成功");
    expect(card.card.header.template).toBe("green");
    expect(card.card.config.wide_screen_mode).toBe(true);

    const divElement = card.card.elements[0] as {
      tag: string;
      fields: Array<{ is_short: boolean; text: { tag: string; content: string } }>;
    };
    const fields = divElement.fields;
    expect(fields).toHaveLength(8);

    // Verify order amount
    expect(fields[0].text.content).toContain("订单金额");
    expect(fields[0].text.content).toContain("¥58.00");

    // Verify cumulative amount
    expect(fields[1].text.content).toContain("累计支付");
    expect(fields[1].text.content).toContain("¥68.00");

    // Verify credits
    expect(fields[2].text.content).toContain("积分数量");
    expect(fields[2].text.content).toContain("58,000");

    // Verify credit status
    expect(fields[3].text.content).toContain("积分是否已发放");
    expect(fields[3].text.content).toContain("✅ 已发放");

    // Verify provider
    expect(fields[4].text.content).toContain("支付渠道");
    expect(fields[4].text.content).toContain("Waffo Pancake");

    // Verify masked email
    expect(fields[5].text.content).toContain("邮箱");
    expect(fields[5].text.content).toContain("329****@qq.com");

    // Verify divider and footer note
    expect(card.card.elements[1].tag).toBe("hr");
    const noteElement = card.card.elements[2] as {
      tag: string;
      elements: Array<{ tag: string; content: string }>;
    };
    expect(noteElement.tag).toBe("note");
    expect(noteElement.elements[0].content).toContain(
      "消息由系统自动推送",
    );
  });

  it("builds the red card format for payment webhook errors", () => {
    const card = buildFeishuWebhookErrorCard({
      provider: "pancake",
      stage: "reconciliation",
      errorMessage: "Payment amount/currency mismatch",
      orderId: "ord_fail_1",
      userId: "usr_fail_1",
      userEmail: "fail_user@example.com",
      paymentId: "pay_fail_1",
      occurredAt: 1729421685000,
    });

    expect(card.msg_type).toBe("interactive");
    expect(card.card.header.title.content).toBe("🚨 支付 Webhook 处理异常");
    expect(card.card.header.template).toBe("red");
    expect(card.card.config.wide_screen_mode).toBe(true);

    const divElement = card.card.elements[0] as {
      tag: string;
      fields: Array<{ is_short: boolean; text: { tag: string; content: string } }>;
    };
    const fields = divElement.fields;
    expect(fields).toHaveLength(6);
    expect(fields[0].text.content).toContain("Waffo Pancake");
    expect(fields[1].text.content).toContain("数据对账与履约入账");
    expect(fields[2].text.content).toContain("ord_fail_1");
    expect(fields[3].text.content).toContain("fai****@example.com");
    expect(fields[4].text.content).toContain("pay_fail_1");

    const errorDiv = card.card.elements[2] as {
      tag: string;
      text: { tag: string; content: string };
    };
    expect(errorDiv.text.content).toContain("Payment amount/currency mismatch");
  });

  it("builds the orange card format for subscription past due alerts", () => {
    const card = buildFeishuSubscriptionPastDueCard({
      orderId: "ord_sub_1",
      userId: "usr_sub_1",
      subscriptionId: "sub_remote_123",
      provider: "stripe",
      planId: "creator",
      updatedAt: 1729421685000,
      userEmail: "subscriber@test.com",
      registeredAt: 1722758722000,
    });

    expect(card.msg_type).toBe("interactive");
    expect(card.card.header.title.content).toBe("⚠️ 订阅自动续费失败 / 账户逾期");
    expect(card.card.header.template).toBe("orange");

    const divElement = card.card.elements[0] as {
      tag: string;
      fields: Array<{ is_short: boolean; text: { tag: string; content: string } }>;
    };
    const fields = divElement.fields;
    expect(fields).toHaveLength(8);
    expect(fields[0].text.content).toContain("创作者");
    expect(fields[1].text.content).toContain("Stripe");
    expect(fields[2].text.content).toContain("sub****@test.com");
    expect(fields[4].text.content).toContain("sub_remote_123");
    expect(fields[5].text.content).toContain("PAST_DUE");
  });
});

describe("feishu notification execution safety", () => {
  it("skips delivery gracefully when FEISHU_WEBHOOK_URL is not configured", async () => {
    // When no webhook URL is configured in environment
    const result1 = await notifyFeishuPayment({
      orderId: "ord_1",
      userId: "usr_1",
      amount: 5800,
      currency: "CNY",
      credits: 58000,
      provider: "pancake",
      paymentId: "pay_1",
    });
    expect(result1).toBe(false);

    const result2 = await notifyFeishuWebhookError({
      provider: "pancake",
      stage: "webhook_handling",
      errorMessage: "Invalid signature",
    });
    expect(result2).toBe(false);

    const result3 = await notifyFeishuSubscriptionPastDue({
      orderId: "ord_1",
      userId: "usr_1",
      subscriptionId: "sub_1",
      provider: "stripe",
      status: "PAST_DUE",
      updatedAt: Date.now(),
    });
    expect(result3).toBe(false);
  });

  it("posts rich interactive card when FEISHU_WEBHOOK_URL is configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    (env as any).FEISHU_WEBHOOK_URL =
      "https://open.feishu.cn/open-apis/bot/v2/hook/test-hook";
    (env as any).FEISHU_WEBHOOK_SECRET = "secret123";

    try {
      // 1. Webhook error delivery
      const errorResult = await notifyFeishuWebhookError({
        provider: "pancake",
        stage: "reconciliation",
        orderId: "ord_err",
        userId: "usr_err",
        paymentId: "pay_err",
        errorMessage: "Payment amount/currency mismatch",
      });
      expect(errorResult).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, req] = fetchMock.mock.calls[0];
      expect(url).toBe("https://open.feishu.cn/open-apis/bot/v2/hook/test-hook");
      const errorPayload = JSON.parse(req.body);
      expect(errorPayload.sign).toBeDefined();
      expect(errorPayload.timestamp).toBeDefined();
      expect(errorPayload.card.header.title.content).toBe("🚨 支付 Webhook 处理异常");
      expect(errorPayload.card.header.template).toBe("red");

      // 2. Subscription past due delivery
      const pastDueResult = await notifyFeishuSubscriptionPastDue({
        orderId: "ord_sub",
        userId: "usr_sub",
        subscriptionId: "sub_remote_1",
        provider: "stripe",
        planId: "creator",
        status: "PAST_DUE",
        updatedAt: 1729421685000,
      });
      expect(pastDueResult).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const [, req2] = fetchMock.mock.calls[1];
      const subPayload = JSON.parse(req2.body);
      expect(subPayload.card.header.title.content).toBe(
        "⚠️ 订阅自动续费失败 / 账户逾期",
      );
      expect(subPayload.card.header.template).toBe("orange");
    } finally {
      globalThis.fetch = originalFetch;
      delete (env as any).FEISHU_WEBHOOK_URL;
      delete (env as any).FEISHU_WEBHOOK_SECRET;
    }
  });
});
