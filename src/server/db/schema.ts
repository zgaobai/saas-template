import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    closedAt: integer("closed_at"),
    disabledAt: integer("disabled_at"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("admin_users_time_idx").on(t.createdAt, t.id)],
);
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    index("account_signup_idx").on(t.userId, t.createdAt, t.id),
  ],
);
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
export const wallets = sqliteTable("wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
});
export const ledger = sqliteTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("ledger_user_idx").on(t.userId, t.createdAt),
    index("admin_ledger_time_idx").on(t.createdAt, t.id),
  ],
);
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    planId: text("plan_id").notNull(),
    planName: text("plan_name").notNull().default(""),
    paymentMode: text("payment_mode"),
    billingInterval: text("billing_interval"),
    productRef: text("product_ref"),
    provider: text("provider").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    credits: integer("credits").notNull(),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id"),
    checkoutUrl: text("checkout_url"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("admin_orders_time_idx").on(t.createdAt, t.id),
    index("admin_orders_status_time_idx").on(t.status, t.createdAt, t.id),
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_user_page_idx").on(t.userId, t.createdAt, t.id),
    uniqueIndex("order_provider_idx").on(t.providerId),
  ],
);
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    providerId: text("provider_id").notNull().unique(),
    planId: text("plan_id").notNull(),
    status: text("status").notNull(),
    paidUntil: integer("paid_until").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("subscription_user_idx").on(t.userId),
    index("subscription_user_updated_idx").on(t.userId, t.updatedAt, t.id),
    index("admin_subscriptions_time_idx").on(t.updatedAt, t.id),
    index("admin_subscriptions_status_time_idx").on(
      t.status,
      t.updatedAt,
      t.id,
    ),
  ],
);
export const paymentEvents = sqliteTable("payment_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  kind: text("kind").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    toolId: text("tool_id").notNull().default("copywriting"),
    tone: text("tone").notNull(),
    output: text("output"),
    completedAt: integer("completed_at"),
    errorCode: text("error_code"),
    status: text("status").notNull(),
    cost: integer("cost").notNull(),
    model: text("model").notNull().default(""),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("generation_user_idx").on(t.userId, t.createdAt),
    index("admin_tasks_time_idx").on(t.createdAt, t.id),
    index("admin_tasks_status_time_idx").on(t.status, t.createdAt, t.id),
  ],
);
export const files = sqliteTable(
  "files",
  {
    status: text("status").notNull().default("ready"),
    updatedAt: integer("updated_at").notNull().default(0),
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("files_user_idx").on(t.userId)],
);
export const audit = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("admin_audit_time_idx").on(t.createdAt, t.id)],
);

export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});
export const receipts = sqliteTable(
  "receipts",
  {
    coveredUntil: integer("covered_until").notNull().default(0),
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    userId: text("user_id").notNull(),
    providerId: text("provider_id").notNull().unique(),
    amount: integer("amount").notNull(),
    credits: integer("credits").notNull(),
    refunded: integer("refunded").notNull().default(0),
    revoked: integer("revoked").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("receipts_time_idx").on(t.createdAt)],
);

export const refundEvents = sqliteTable(
  "refund_events",
  {
    id: text("id").primaryKey(),
    receiptId: text("receipt_id")
      .notNull()
      .references(() => receipts.id),
    amount: integer("amount").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("refund_events_time_idx").on(t.createdAt)],
);

export const requestLimits = sqliteTable("request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});
export const maintenanceState = sqliteTable("maintenance_state", {
  id: text("id").primaryKey(),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until").notNull().default(0),
  startedAt: integer("started_at").notNull().default(0),
  completedAt: integer("completed_at").notNull().default(0),
  status: text("status").notNull().default("idle"),
});

export const planConfigs = sqliteTable("plan_configs", {
  annualPrice: integer("annual_price"),
  annualPaymentBindings: text("annual_payment_bindings")
    .notNull()
    .default("{}"),
  interval: text("billing_interval"),
  paymentBindings: text("payment_bindings").notNull().default("{}"),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull(),
  price: integer("price").notNull(),
  credits: integer("credits").notNull(),
  description: text("description").notNull(),
  features: text("features").notNull(),
  enabled: integer("enabled").notNull().default(1),
  revision: integer("revision").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});
export const redeemCodes = sqliteTable(
  "redeem_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull().unique(),
    codeCiphertext: text("code_ciphertext"),
    hint: text("hint").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    planId: text("plan_id"),
    planName: text("plan_name"),
    credits: integer("credits").notNull(),
    days: integer("days").notNull().default(0),
    termMonths: integer("term_months").notNull().default(0),
    grantMonths: integer("grant_months").notNull().default(1),
    maxUses: integer("max_uses").notNull(),
    used: integer("used").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
    disabledAt: integer("disabled_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("redeem_codes_time_idx").on(t.createdAt, t.id)],
);
export const redemptions = sqliteTable(
  "redemptions",
  {
    id: text("id").primaryKey(),
    codeId: text("code_id")
      .notNull()
      .references(() => redeemCodes.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    credits: integer("credits").notNull(),
    grantMonths: integer("grant_months").notNull().default(1),
    startsAt: integer("starts_at").notNull().default(0),
    planId: text("plan_id"),
    planName: text("plan_name"),
    expiresAt: integer("expires_at").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("redemption_once_idx").on(t.codeId, t.userId),
    index("redemption_user_time_idx").on(t.userId, t.createdAt),
    index("redemption_user_page_idx").on(t.userId, t.createdAt, t.id),
    index("redemption_time_idx").on(t.createdAt, t.id),
  ],
);

export const creditInstallments = sqliteTable(
  "credit_installments",
  {
    id: text("id").primaryKey(),
    receiptId: text("receipt_id")
      .notNull()
      .references(() => receipts.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    installment: integer("installment").notNull(),
    credits: integer("credits").notNull(),
    dueAt: integer("due_at").notNull(),
    grantedAt: integer("granted_at"),
    canceledAt: integer("canceled_at"),
  },
  (t) => [
    index("installments_due_idx").on(t.grantedAt, t.canceledAt, t.dueAt),
    index("installments_user_due_idx").on(
      t.userId,
      t.grantedAt,
      t.canceledAt,
      t.dueAt,
    ),
    uniqueIndex("installment_receipt_idx").on(t.receiptId, t.installment),
  ],
);

export const redemptionInstallments = sqliteTable(
  "redemption_installments",
  {
    id: text("id").primaryKey(),
    redemptionId: text("redemption_id")
      .notNull()
      .references(() => redemptions.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    installment: integer("installment").notNull(),
    credits: integer("credits").notNull(),
    dueAt: integer("due_at").notNull(),
    grantedAt: integer("granted_at"),
  },
  (t) => [
    uniqueIndex("redemption_installment_once_idx").on(
      t.redemptionId,
      t.installment,
    ),
    index("redemption_installments_due_idx").on(t.grantedAt, t.dueAt),
    index("redemption_installments_user_due_idx").on(
      t.userId,
      t.grantedAt,
      t.dueAt,
    ),
  ],
);

export const aiConfigs = sqliteTable("ai_configs", {
  id: text("id").primaryKey(),
  baseUrl: text("base_url"),
  apiKeyCiphertext: text("api_key_ciphertext"),
  apiKeyHint: text("api_key_hint"),
  apiStyle: text("api_style").notNull().default("chat"),
  textModel: text("text_model").notNull().default("deepseek-ai/DeepSeek-V3"),
  textModelsJson: text("text_models_json").notNull().default("[]"),
  imageModel: text("image_model"),
  imageModelsJson: text("image_models_json").notNull().default("[]"),
  videoModel: text("video_model"),
  videoModelsJson: text("video_models_json").notNull().default("[]"),
  audioModel: text("audio_model"),
  audioModelsJson: text("audio_models_json").notNull().default("[]"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by").references(() => user.id),
});

export const announcements = sqliteTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    type: text("type").notNull().default("info"), // 'info' | 'promotion' | 'warning'
    linkUrl: text("link_url").notNull().default(""),
    linkText: text("link_text").notNull().default(""),
    isActive: integer("is_active").notNull().default(1),
    dismissible: integer("dismissible").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("announcements_active_idx").on(t.isActive, t.createdAt)],
);

export const feedbacks = sqliteTable(
  "feedbacks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    userEmail: text("user_email").notNull(),
    type: text("type").notNull().default("suggestion"), // 'suggestion' | 'bug' | 'billing' | 'other'
    title: text("title").notNull(),
    content: text("content").notNull(),
    contact: text("contact").notNull().default(""),
    status: text("status").notNull().default("pending"), // 'pending' | 'in_progress' | 'resolved' | 'closed'
    adminNotes: text("admin_notes").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("feedbacks_status_idx").on(t.status, t.createdAt)],
);

