export type AdminPage<T> = { items: T[]; nextCursor: string | null };
export type AdminUser = {
  email_verified: number;
  registration_provider: string | null;
  has_google: number;
  has_password: number;
  id: string;
  name: string;
  email: string;
  created_at: number;
  closed_at: number | null;
  disabled_at: number | null;
  balance: number;
  attribution_channel?: string | null;
  attribution_source?: string | null;
};
export type AdminOrder = {
  billing_interval: string | null;
  plan_name: string;
  id: string;
  user_id: string;
  name: string;
  email: string;
  plan_id: string;
  provider: string;
  provider_id: string | null;
  amount: number;
  currency: string;
  credits: number;
  grant_months?: number;
  status: string;
  created_at: number;
};
export type AdminSubscription = {
  billing_interval: string | null;
  plan_name: string;
  id: string;
  user_id: string;
  name: string;
  email: string;
  order_id: string;
  provider: string;
  provider_id: string;
  plan_id: string;
  status: string;
  paid_until: number;
  updated_at: number;
};
export type AdminAudit = {
  id: string;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  target_id: string;
  target_name: string | null;
  target_email: string | null;
  action: string;
  created_at: number;
};
export const orderStatuses = {
  pending: "待确认",
  paid: "已付款",
  refunded: "已退款",
  expired: "已关闭 / 过期",
  failed: "付款失败",
};
export const subscriptionStatuses = {
  ACTIVE: "订阅中",
  CANCELING: "取消确认中",
  AUTHORIZATION_REQUIRED: "待付款授权",
  IN_PROGRESS: "处理中",
  CANCELED: "已取消",
  EXPIRED: "已结束",
  PAST_DUE: "续费逾期",
  MERCHANT_CANCELLED: "商户已取消",
  USER_CANCELLED: "用户已取消",
  CHANNEL_CANCELLED: "渠道已取消",
  CLOSE: "已关闭",
};
export const paymentProviders = {
  pancake: "Waffo Pancake",
  stripe: "Stripe",
  creem: "Creem",
  paypal: "PayPal",
};
export function labelFor(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}
export type AdminTask = {
  refunded: number;
  id: string;
  user_id: string;
  name: string;
  email: string;
  tool_id: string;
  status: string;
  cost: number;
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_micros?: number;
  created_at: number;
  completed_at: number | null;
  error_code: string | null;
};
export type TaskDetail = AdminTask & {
  prompt: string;
  output: string | null;
  tone: string;
};
export type AdminLedger = {
  order_id: string | null;
  id: string;
  user_id: string;
  name: string;
  email: string;
  amount: number;
  reason: string;
  created_at: number;
};
export type AdminCode = {
  code: string | null;
  code_status: "ready" | "legacy" | "unavailable";
  id: string;
  hint: string;
  name: string;
  kind: string;
  plan_id: string | null;
  plan_name: string | null;
  credits: number;
  grant_months?: number;
  days: number;
  term_months: number;
  max_uses: number;
  used: number;
  expires_at: number;
  disabled_at: number | null;
  created_at: number;
};
export type AdminRedemption = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  code_id: string;
  code_name: string;
  code: string | null;
  code_status: "ready" | "legacy" | "unavailable";
  hint: string;
  credits: number;
  grant_months?: number;
  plan_name: string | null;
  expires_at: number;
  created_at: number;
};
export type AdminAiModelUsage = {
  model: string;
  total_count: number;
  completed_count: number;
  failed_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_micros: number;
  credits_charged: number;
  avg_duration_ms: number | null;
};
export type AdminOverview = {
  from: number;
  until: number;
  users: { count: number };
  orders: { count: number; paid: number; pending: number };
  tasks: {
    count: number;
    completed: number;
    failed: number;
    pending: number;
    blocked: number;
    total_tokens?: number;
    total_cost_micros?: number;
  };
  credits: { issued: number; spent: number };
  revenue: { currency: string; received: number; refunded: number }[];
  daily: { day: string; count: number; completed: number }[];
  aiUsage?: AdminAiModelUsage[];
  channels?: { channel: string; count: number }[];
};
export const taskStatuses = {
  pending: "生成中",
  completed: "已完成",
  failed: "失败",
  blocked: "审核拦截",
};
export const taskErrors: Record<string, string> = {
  generation_failed: "生成服务未能完成，已退回积分",
  timeout: "任务超时，已退回积分",
  moderation_blocked: "内容未通过审核，未扣积分",
  moderation_unavailable: "审核服务暂不可用，未扣积分",
};

export type AdminUserDetail = {
  user: AdminUser;
  freePlanName: string;
  entitlement: {
    plan_id: string;
    plan_name: string;
    paid_until: number;
    status: string;
  } | null;
  attribution?: import("../attribution/types").UserAttributionRecord | null;
};
export type UserRecord = {
  billing_interval?: string | null;
  email?: string;
  name?: string;
  code_id?: string;
  code_name?: string;
  code?: string | null;
  code_status?: "ready" | "legacy" | "unavailable";
  hint?: string;
  id: string;
  created_at?: number;
  status?: string;
  tool_id?: string;
  cost?: number;
  refunded?: number;
  completed_at?: number | null;
  amount?: number;
  reason?: string;
  plan_name?: string | null;
  provider?: string;
  credits?: number;
  grant_months?: number;
  expires_at?: number;
  plan_id?: string;
  order_id?: string;
  paid_until?: number;
  updated_at?: number;
};
export const registrationMethods: Record<string, string> = {
  credential: "邮箱注册",
  google: "Google",
};

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  type: "info" | "promotion" | "warning";
  link_url: string;
  link_text: string;
  is_active: number;
  dismissible: number;
  created_at: number;
  updated_at: number;
}

export interface DiagnosticsReport {
  feishu: {
    configured: boolean;
    webhookUrlMasked: string;
    hasSecret: boolean;
  };
  email: {
    configured: boolean;
    emailFrom: string;
    apiKeyMasked: string;
  };
  google: {
    configured: boolean;
    clientIdMasked: string;
  };
  payments: {
    activeProvider: string;
    pancake: boolean;
    stripe: boolean;
    creem: boolean;
    paypal: boolean;
  };
  storage: {
    dbOk: boolean;
    totalFiles: number;
    totalStorageBytes: number;
    totalUsers: number;
  };
}
