# 环境配置指南

本项目采用标准化的双/三环境配置文件体系，告别复杂的命令行逐条设置与深层 JSON 修改。

## 环境配置文件一览

| 环境 | 配置文件 | 模版文件 | 对应命令 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **本地开发 / 测试** | `.dev.vars` | `.env.example` | `npm run dev` | 本地 SQLite 隔离，自动生成密钥，零凭据开箱即跑 |
| **预发布环境 (Staging)** | `.env.staging` | `.env.staging.example` | `npm run deploy:staging` | 独立测试站，使用测试商户凭据与测试数据库 |
| **线上正式 (Production)** | `.env.production` | `.env.production.example` | `npm run deploy:production` | 正式商业站，使用正式商户凭据与生产数据库 |

> [!NOTE]
> `.dev.vars`、`.env.staging`、`.env.production` 均已被加入 `.gitignore`，绝不会提交进 Git 版本库。
> 模版文件 `.env.example`、`.env.staging.example`、`.env.production.example` 随代码库开源，提供字段名称与注释说明。

---

## 一键批量同步机制 (sync-env)

当执行 `npm run deploy:production`（或 `deploy:staging`）时，系统会自动调用 `scripts/sync-env.mjs`：
1. **自动同步基础配置**：从 `.env.production` 读取 `APP_URL` 与 `D1_DATABASE_ID`，自动注入 `wrangler.jsonc` 对应环境节点。
2. **批量加密上传密钥**：自动提取所有非空私密凭据（如 `RESEND_API_KEY`、商户私钥等），通过官方 `wrangler secret bulk` 在 1 秒内批量同步到 Cloudflare Secrets。
3. **自动补齐会话密钥**：若 `BETTER_AUTH_SECRET` 留空，脚本会自动生成高强度随机密钥并写回文件，无需手动折腾。

如需单独更新密钥，也可直接运行：
```bash
# 批量同步生产环境密钥
npm run env:sync:production

# 批量同步预发布环境密钥
npm run env:sync:staging
```

---

## 配置项详细说明

### 1. 域名与资源绑定
- `APP_URL`：站点的完整对外访问 HTTPS 协议域名（本地开发为 `http://127.0.0.1:4317`）。
- `D1_DATABASE_ID`：Cloudflare D1 边缘 SQLite 数据库 ID（执行 `npx wrangler d1 create <name>` 输出）。
- `R2_BUCKET_NAME`：Cloudflare R2 对象存储桶名称（用于用户生成物与导出文件存储）。

### 2. 身份认证与会话
- `BETTER_AUTH_SECRET`：至少 32 字符的会话签名密钥（留空自动生成）。
- `REDEMPTION_ENCRYPTION_KEY`：64 位 Hex 兑换卡密加密密钥（留空自动生成）。
- `ADMIN_USER_IDS`：以半角逗号分隔的管理员 User ID 列表，授权访问 `/admin` 管理后台。
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`：（可选）Google OAuth 一键登录。
- **注册防刷与反羊毛机制**：内置 Cloudflare 边缘 IP 频控（10 次/小时）、400+ 临时黑产邮箱过滤与 Gmail/主流邮箱别名规整去重，开箱即用，无需额外配置第三方反欺诈环境变量。

### 3. AI 模型与内容合规
- **AI 大模型管理**：所有 AI 厂商与模型（DeepSeek、OpenAI、Claude 等）、API Key 与端点统一通过【管理员后台 `/admin/ai`】可视化添加、测试与动态切换，无需在环境文件中配置。
- `MODERATION_PROVIDER`：提示词合规审查引擎（默认 `pancake`，或可选 `creem`）。

### 4. 事务性邮件 (Resend)
- `RESEND_API_KEY`：Resend 平台 API Key。
- `EMAIL_FROM`：发件人邮箱地址（需在 Resend 控制台完成发信域名验证，如 `support@yourdomain.com`）。

### 5. 商业支付渠道
通过 `PAYMENT_PROVIDER` 选择默认支付方式（`pancake`、`stripe`、`creem`、`paypal`）：
- **Waffo Pancake**：`PANCAKE_MERCHANT_ID`、`PANCAKE_PRIVATE_KEY`、`PANCAKE_WEBHOOK_PUBLIC_KEY`、`PANCAKE_STORE_ID`（可选覆盖端点 `PANCAKE_BASE_URL`，默认 `https://api.waffo.ai`）
- **Stripe**：`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`（可选覆盖端点 `STRIPE_BASE_URL`，默认 `https://api.stripe.com`）
- **Creem**：`CREEM_API_KEY`、`CREEM_WEBHOOK_SECRET`（可选覆盖端点 `CREEM_BASE_URL`）
- **PayPal**：`PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_WEBHOOK_ID`（可选覆盖端点 `PAYPAL_BASE_URL`）

### 6. 网站访问统计（仅生产环境注入）
- `GA_MEASUREMENT_ID`：Google Analytics 4 衡量 ID（例如 `G-XXXXXXXXXX`）。
- `UMAMI_WEBSITE_ID` / `UMAMI_SCRIPT_URL`：Umami 统计 ID 与脚本地址。

### 7. 运营监控与即时告警 (飞书机器人)
- `FEISHU_WEBHOOK_URL`：（可选）飞书群自定义机器人的 Webhook 地址。配置后，当全渠道有任意新订单支付成功并完成积分发放时，自动向群内推送带绿色标题栏的富文本卡片通知。留空则自动关闭。
- `FEISHU_WEBHOOK_SECRET`：（可选）飞书机器人的签名密钥，系统将自动使用 Web Crypto 计算 HMAC-SHA256 签名，提升告警通道安全性。
