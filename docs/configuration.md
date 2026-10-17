# 公共服务配置

母版已实现登录、邮件、AI 文本调用、积分账本、私有文件、四渠道支付及回调处理。既有能力通过环境配置启用；新业务放在 modules 内开发。未填齐凭据的服务保持不可用，不模拟成功生成或到账。

配置已分本地、staging 和 production；完整默认值、命令及隔离规则见 [环境配置](environments.md)。线上公共参数分别填写 wrangler.jsonc 的 env.staging.vars 和 env.production.vars。

## 配置放在哪里

| 内容                                         | 本地                                            | Cloudflare 正式环境           |
| -------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| 密钥、OAuth secret、Webhook secret、商户私钥 | 不提交的 .dev.vars，权限 600                    | Workers Secrets               |
| 服务地址、模型名、环境、默认支付渠道         | wrangler.jsonc 的 vars，或 .dev.vars 覆盖       | wrangler.jsonc 的 vars        |
| D1、R2 资源                                  | Wrangler 本地模拟绑定                           | wrangler.jsonc 的真实资源绑定 |
| 品牌、文案、价格、积分数量                   | src/site.ts、页面组件、modules/billing/plans.ts | 随代码发布                    |

禁止用 VITE_* 放凭据，也不要把环境对象整包返回前端。前端只收到 auth/email/google/ai/payments/local 等允许公开的布尔状态。对外错误不包含上游错误正文、请求头和密钥。

.env.example 是名称清单，没有真实值。现有 .dev.vars 不会被初始化脚本覆盖；新项目运行 npm run setup:local。升级项目时，手动从示例添加需要的新名称。

npm run config:check 合并本地 Wrangler vars、.dev.vars、进程环境，只打印缺项名称和状态。它验证配置是否完整，不发第三方请求，不代表密钥有效。--env staging / --env production 不读取本机 .dev.vars，适合已注入配置的 CI；--production 是选择 production 的兼容写法。npm run deploy 前置检查另会读取 Cloudflare 上的 secret 名称，确认认证/正式邮件依赖存在，不读取或展示 secret 值。

## 公共模块所需设置

| 模块   | 配置                                                     | 外部准备                                    |
| ------ | -------------------------------------------------------- | ------------------------------------------- |
| 认证   | BETTER_AUTH_SECRET，至少32字符                           | 本地自动生成；生产独立设置                  |
| 邮件   | RESEND_API_KEY、EMAIL_FROM                               | Resend 验证发信域名；正式邮箱注册依赖邮件   |
| Google | GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET                   | OAuth 回调 APP_URL/api/auth/callback/google |
| AI     | OPENAI_API_KEY、AI_MODEL；可选 AI_BASE_URL、AI_API_STYLE | 取得模型访问权限                            |
| 存储   | DB、FILES 绑定                                           | 创建 D1/R2，应用迁移                        |
| 管理员 | ADMIN_USER_IDS                                           | 填写已有用户 ID，逗号分隔                   |

AI_API_STYLE=responses 默认使用 OpenAI Responses；兼容 Chat Completions 的服务使用 chat，设置对应 AI_BASE_URL（包含 /v1 等服务商要求的路径）和 AI_MODEL。凭据仍使用 OPENAI_API_KEY 这个变量名。不同厂商专有协议不因此自动兼容。AI_BASE_URL 必须 HTTPS，只有本地开发 localhost/127.0.0.1 允许 HTTP。接入层在 modules/ai/server/model.ts，业务提示词在 modules/tools/server/prompts.ts。

### 认证安全与反薅羊毛机制

系统在身份认证接入层内置了三道防刷防羊毛规则，无需额外配置第三方付费反欺诈服务即可生效：
- **边缘 IP 频控限制**：基于 Cloudflare Workers 注入的 `cf-connecting-ip` 限制单个 IP 每小时最多注册 10 次；超限返回 HTTP 429。本地开发（`APP_ENV === "development"`）自动豁免匿名流量，避免调试锁死。
- **一次性临时邮箱阻断**：内置 400+ 临时黑产邮箱服务域名及通配子域黑名单，在注册验证阶段拦截并返回 HTTP 400。
- **主流邮箱别名规范化去重**：对 Gmail 自动剔除点号 `.` 与 `+` 标签（如 `a.b.c+test@gmail.com` -> `abc@gmail.com`），对 Outlook、Hotmail、iCloud、Proton 等自动清洗 `+` 别名标签；规整后通过数据库 `UNIQUE(email)` 约束拦截，防止利用同一实体邮箱通过别名无限次重复领取初始免费积分。

## 支付共通规则

PAYMENT_PROVIDER 可选 pancake、stripe、creem、paypal，默认 pancake。页面统一调用内部结账接口，不携带价格、积分或提供商选择。历史订单保留提供商、金额和积分；切换默认渠道不会更改历史订单。保留旧渠道凭据和回调，直到旧订阅和退款结束。

回调地址是 APP_URL/api/webhooks/pancake、stripe、creem、paypal，使用可公网访问的 HTTPS。返回页不授予积分：回调验证来源，再向服务商 API 回查身份、金额、币种；付款凭证去重后入账。退款按凭证撤回积分，重复和乱序累计退款不会重复扣除。取消后已付周期保留到期。

当前范围是 USD 固定订阅与一次性积分包；同一个订阅套餐维护月价和可选年价，两种计费方式共享每月积分和功能，分别绑定月付/年付商品。年付按全年实付金额配置优惠，积分按月发放 12 期；不包含结账折扣码、按量计费、试用、升降级按比例计费、团队席位、跨币种换算或自动拒付仲裁。金额不符时拒绝发放完整套餐权益。需要这些模式时应扩展计费契约再启用。

## Waffo Pancake（默认）

配置 `PANCAKE_MERCHANT_ID`、`PANCAKE_PRIVATE_KEY`、`PANCAKE_WEBHOOK_PUBLIC_KEY`、`PANCAKE_STORE_ID`。`PANCAKE_ENVIRONMENT=test|prod` 用于回调环境校验。API 请求的实际环境由后台签发的密钥决定，不通过请求头切换；切换正式环境时同时更换对应密钥和验签公钥。

在同一店铺创建 active 月付/年付订阅或一次性积分包，在套餐编辑弹窗填写对应商品 ID（旧内置套餐环境变量映射仍兼容）。模板先验证产品归属、类型和月/年周期，再以服务端套餐价格创建含税 USD 会话；明确关闭试用。`APP_URL` 必须是公网 HTTPS，测试支付也需要 HTTPS 地址，不能直接使用本地 HTTP 回跳。

回调地址 `/api/webhooks/pancake`，签名头 `X-Waffo-Signature`。监听 `order.completed`、`subscription.activated/payment_succeeded/renewed/recovered/past_due/canceling/uncanceled/canceled`、`refund.succeeded/failed`。验签接受 45 分钟内的原始签名，兼容渠道重试；按付款与已执行退款的 ID 去重。状态通过 GraphQL 回查，通知和返回页不直接发积分。只在成功付款的 periodNumber 与订阅 currentPeriodNumber 一致时延长当前权益，历史付款不套用最新周期；不推算缺失周期日期。

创建会话时附加本地订单号和归属元数据。创建请求结果不明时不自动重复创建；“核对付款与订阅状态”可按原业务订单号查找。已签发会话但还没有远端订单时，保留待确认状态，不能当作失败。无链接且无法查到订单、过期链接或缺少历史周期数据需要后台核查。核对只处理用户最近10笔待付/已付订单，每笔最多分页读取2000条付款，超出范围报错，不假称完整财务对账。

取消申请的 `canceling` 保持为非终态，阻止重复订阅和提前注销，已付权益保留至到期。远端确认 `canceled` 后更新终态。当前没有接入恢复订阅、改套餐、主动退款、拒付或管理其他店铺。

原 `@waffo/waffo-node` 商户适配器、旧凭据名和 `/api/webhooks/waffo` 已移除。两套协议与订单标识不兼容，不能把历史 provider=waffo 的记录批量改成 pancake；现有本地模板没有这种订单。升级已实际收款的站点需先由运营方结清/迁移原渠道。

## 提示词审核

`MODERATION_PROVIDER=pancake` 为默认值，复用 Pancake 商户 ID 和私钥，无需额外审核密钥；也可选择 `creem` 并配置其 API key。审核渠道与支付渠道独立，例如 Stripe 收款仍能调用 Pancake 审核。当前通过 `modules/moderation/server/service.ts` 的 `assertPromptAllowed` 复用。

Pancake 调用 `scan-prompt` 并设置 `semantic=enforce`，仅明确 `allow/allowed` 才放行；review/block、服务降级、超时和未知响应均阻止生成。Creem 对应 allow/flag/deny，同样只放行 allow。审核在模型调用与积分预扣之前，拒绝或接口故障均不扣积分。审计只记录用户、请求 ID、渠道与判定，不记录提示词和上游原始响应。

`disabled` 仅供明确的本地开发测试使用，生产环境拒绝绕过。配置 AI key 时还须配置审核凭据；`config:check` 会报告缺项。

**范围：当前接通的是用户文本提示词检查。** Pancake PromptSift 并不是图片、视频或 PDF 内容扫描 API；本模板的 R2 上传与生成结果尚未接通这类审核。后续图像/视频产品应按对应供应商的内容接口单独接入文件与输出审核，不能因为提示词通过就宣称全部内容合规。

## Stripe

配置 STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET。Checkout 可在套餐后台绑定并回查 Price ID；不填写时使用服务器套餐生成月/年价格数据，也不需要在浏览器暴露 publishable key。API 固定 Stripe-Version: 2024-06-20，使用托管收银页。

监听 checkout.session.completed、checkout.session.async_payment_succeeded、checkout.session.expired、invoice.paid、customer.subscription.created/updated/deleted、refund.created/updated。invoice.payment_succeeded 也支持，与 invoice.paid 按同一账单去重。建议回调版本同样为 2024-06-20。

取消为 cancel_at_period_end。首期与续费按账单入账；不接受手工记账、零元试用、按比例调整或复杂多行账单作为完整套餐周期付款。测试/正式环境由密钥及对应 Webhook secret 区分。

## Creem

配置 CREEM_API_KEY、CREEM_WEBHOOK_SECRET、CREEM_ENVIRONMENT=test 或 production。每个套餐在后台填写 Creem 商品 ID，原内置套餐的环境映射仍可作为回退。

商户后台建立 active 产品：USD 固定月付、年付或一次性积分包，金额对应后台套餐配置；tax_mode=inclusive，不开启试用、按量价格、企业净价或折扣。创建结账前会核对产品。允许使用 Creem 已验证的自定义收银域。

监听 checkout.completed、subscription.paid、subscription.active/canceled/scheduled_cancel/past_due/unpaid/expired/update/trialing/paused、refund.created。dispute.created 仅在交易 API 已反映实际退款金额时处理，不代表完整拒付工作流。回查交易累计 refunded_amount，本地按差额撤回。

官方文档只说明 request_id 用于跟踪，没有保证创建幂等，也没有按 request_id 回查接口。若创建结果未知且本地没有 URL，模板阻止自动重建。需核对商户后台，确认远端状态后修复订单；不要直接删除 pending 记录后重试，否则可能重复创建订阅。

## PayPal

配置 PAYPAL_CLIENT_ID、PAYPAL_CLIENT_SECRET、PAYPAL_WEBHOOK_ID、PAYPAL_ENVIRONMENT=sandbox 或 production。订阅套餐在后台填写 PayPal Plan ID；原月付环境映射仍兼容。

计划须为 active，USD 金额与后台套餐配置一致：一个无限 REGULAR 月或年周期，无试用/设置费/税/数量计费，auto_bill_outstanding=false，避免补收历史欠款被误认作普通一期。一次性积分包通过 Orders API 创建，无需产品 ID。OAuth token 仅在服务端获取和使用。

监听 CHECKOUT.ORDER.APPROVED、PAYMENT.CAPTURE.COMPLETED、PAYMENT.CAPTURE.REFUNDED、PAYMENT.SALE.COMPLETED、PAYMENT.SALE.REFUNDED、BILLING.SUBSCRIPTION.* 生命周期事件。已验签的批准通知触发自动 capture；capture 前核对本地订单归属与金额。跳转页不代表成功付款。

订阅按交易 ID 去重；付款时间匹配回查的最新已付周期时才用 next_billing_time 延长权益。同步覆盖最近32天，历史回调按指定交易处理。更早的漏单需人工对账，不宣称全历史自动修复。

## 更换产品与验收

通常只需创建服务资源、填写环境项、登记回调、修改品牌与套餐。Pancake/Creem/PayPal 还需建产品或计划后填写 ID；公开价格须与服务商一致。开户审核、域名验证和沙箱交易不能由占位配置代替。

模板未连接真实商户/模型/邮件账户。测试验证本地逻辑与模拟协议数据；正式启用前仍需用自己的账号跑通注册邮件、生成扣分、首付款、续费、取消、部分/全额退款。

## 核实来源

- [Pancake 认证](https://docs.waffo.ai/api-reference/authentication)
- [Pancake 结账会话](https://docs.waffo.ai/api-reference/endpoints/orders/create-checkout-session)
- [Pancake 回调协议](https://docs.waffo.ai/api-reference/webhooks)
- [Pancake GraphQL](https://docs.waffo.ai/api-reference/endpoints/graphql/overview)
- [Pancake 订单与付款回查](https://docs.waffo.ai/api-reference/endpoints/graphql/orders-and-payments)
- [Pancake 提示词审核](https://docs.waffo.ai/api-reference/endpoints/content-safety/scan-prompt)
- [Creem 提示词审核](https://docs.creem.io/features/moderation)

- [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create?api-version=2024-06-20)
- [Stripe Invoice](https://docs.stripe.com/api/invoices/object?api-version=2024-06-20)
- [Creem API](https://docs.creem.io/api-reference/introduction)
- [Creem Webhooks](https://docs.creem.io/code/webhooks)
- [PayPal Webhook 验证](https://developer.paypal.com/api/rest/webhooks/rest/)
- [PayPal Subscriptions](https://developer.paypal.com/api/subscriptions/v1)
