import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { site } from "@/site";
import { formatDateTime } from "@/lib/date";

export interface FeishuPaymentNotifyParams {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  credits: number;
  provider: string;
  paymentId: string;
}

export function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local}***@${domain}`;
  }
  const visible = local.slice(0, 3);
  return `${visible}****@${domain}`;
}

export function getProviderLabel(provider: string): string {
  switch (provider.toLowerCase()) {
    case "pancake":
      return "Waffo Pancake";
    case "stripe":
      return "Stripe";
    case "creem":
      return "Creem";
    case "paypal":
      return "PayPal";
    default:
      return provider;
  }
}

export function formatCurrency(amountCents: number, currency: string): string {
  const code = currency.toUpperCase();
  const symbol =
    code === "CNY" ? "¥" : code === "EUR" ? "€" : code === "GBP" ? "£" : "$";
  return `${symbol}${(amountCents / 100).toFixed(2)}`;
}

export async function signFeishuWebhook(
  timestamp: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const stringToSign = `${timestamp}\n${secret}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(stringToSign),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new Uint8Array(0));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export function buildFeishuCard(params: {
  amount: number;
  currency: string;
  cumulativeAmount: number;
  credits: number;
  provider: string;
  email: string;
  registeredAt: number;
  paidAt: number;
}) {
  const orderAmountStr = formatCurrency(params.amount, params.currency);
  const cumulativeAmountStr = formatCurrency(
    params.cumulativeAmount,
    params.currency,
  );
  const creditsStr = params.credits.toLocaleString("zh-CN");
  const providerLabel = getProviderLabel(params.provider);
  const maskedEmail = maskEmail(params.email);
  const registeredTimeStr = formatDateTime(params.registeredAt, "zh");
  const paidTimeStr = formatDateTime(params.paidAt, "zh");

  return {
    msg_type: "interactive",
    card: {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: "plain_text",
          content: "💰 新订单支付成功",
        },
        template: "green",
      },
      elements: [
        {
          tag: "div",
          fields: [
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: `**💵 订单金额：**\n${orderAmountStr}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: `**🎇 累计支付：**\n${cumulativeAmountStr}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: `**✨ 积分数量：**\n${creditsStr}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: "**🎁 积分是否已发放：**\n✅ 已发放",
              },
            },
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: `**💳 支付渠道：**\n${providerLabel}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: `**📧 邮箱：**\n${maskedEmail}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: `**🕒 用户注册时间：**\n${registeredTimeStr}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: "lark_md",
                content: `**🕒 支付时间：**\n${paidTimeStr}`,
              },
            },
          ],
        },
        {
          tag: "hr",
        },
        {
          tag: "note",
          elements: [
            {
              tag: "plain_text",
              content: `站点 ${site.name} 消息由系统自动推送`,
            },
          ],
        },
      ],
    },
  };
}

export async function notifyFeishuPayment(
  params: FeishuPaymentNotifyParams,
): Promise<boolean> {
  const env = bindings();
  const webhookUrl = env.FEISHU_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  try {
    const db = env.DB;
    // Batch query to reduce D1 database round-trips from 2 to 1
    const [userRes, totalRes] = await db.batch([
      db
        .prepare("SELECT email, created_at FROM user WHERE id=?")
        .bind(params.userId),
      db
        .prepare(
          "SELECT SUM(amount) as total FROM receipts WHERE user_id=? AND refunded < amount",
        )
        .bind(params.userId),
    ]);

    const u = (userRes?.results?.[0] || null) as {
      email: string;
      created_at: number;
    } | null;
    const totalRow = (totalRes?.results?.[0] || null) as {
      total: number | null;
    } | null;

    const cumulativeAmount = totalRow?.total || params.amount;
    const email = u?.email || "unknown@domain.com";
    const registeredAt = u?.created_at || Date.now();
    const paidAt = Date.now();

    const cardPayload = buildFeishuCard({
      amount: params.amount,
      currency: params.currency,
      cumulativeAmount,
      credits: params.credits,
      provider: params.provider,
      email,
      registeredAt,
      paidAt,
    });

    let body: Record<string, unknown> = cardPayload;
    const secret = env.FEISHU_WEBHOOK_SECRET?.trim();
    if (secret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const sign = await signFeishuWebhook(timestamp, secret);
      body = {
        timestamp,
        sign,
        ...cardPayload,
      };
    }

    // Enforce a strict 2.5s network timeout to guarantee payment webhooks never hang
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        `Feishu webhook delivery failed with status ${res.status}:`,
        text,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to deliver Feishu payment notification:", error);
    return false;
  }
}
