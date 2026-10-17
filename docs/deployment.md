# Cloudflare 部署与外部服务

TanStack Start 同时承担页面和后端；本模板无需额外 FastAPI 服务。Wrangler CLI 用于管理 D1、R2、Secrets、迁移和 Workers 部署。`nodejs_compat` 提供 Workers 的 Node 兼容能力，不意味着可以运行任意常驻 Node/Python 进程。

已预设 staging 与 production 两套独立配置，按 [环境配置指南](environments.md) 创建资源、设置密钥与执行部署。下文命令以 production 为例，测试站使用 staging。

## 资源准备

```sh
npx wrangler login
npx wrangler d1 create qihang-db-production
npx wrangler r2 bucket create qihang-files-production
```

推荐使用 `.env.production` 配置文件管理生产配置（复制 `.env.production.example` 为 `.env.production`，填入 `APP_URL`、`D1_DATABASE_ID`、`RESEND_API_KEY` 及商户凭据等）。执行 `npm run deploy:production` 时，系统会自动同步基础变量并调用 `wrangler secret bulk` 批量上传所有私密凭据。

若需单独更新密钥，也可直接运行：
```sh
npm run env:sync:production
```

也可使用 Wrangler 官方命令行手动单项录入：
```sh
npx wrangler secret put BETTER_AUTH_SECRET --config wrangler.jsonc --env production
npx wrangler secret put RESEND_API_KEY --config wrangler.jsonc --env production
npx wrangler secret put EMAIL_FROM --config wrangler.jsonc --env production
```

正式邮箱注册需要可投递的 Resend 发件域名与 `EMAIL_FROM`。Google 可选，需要 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`；OAuth 回调为 `https://你的域名/api/auth/callback/google`。

AI 大模型（DeepSeek、GPT-4o、Claude、FLUX 等）、API Key 与自定义 Base URL 全部由【管理员后台 `/admin/ai`】在线可视化统一管理并自动加密持久化至数据库，无需在环境配置文件或 Wrangler Secrets 中配置。生产环境上线后直接登录管理后台即可配置并一键测试连通性。

## 商业支付接入 (以默认 Waffo Pancake 为例)

在 Pancake 后台创建店铺，取得对应环境的商户 ID、RSA 私钥与平台回调公钥，填入 `.env.production`（或测试环境 `.dev.vars`）。站内的订阅套餐与商品定价无需在配置文件中编写，全部在管理后台 `/admin/plans` 在线维护与上下架：
```ini
PANCAKE_MERCHANT_ID=...
PANCAKE_PRIVATE_KEY=...
PANCAKE_WEBHOOK_PUBLIC_KEY=...
PANCAKE_STORE_ID=...
```

私钥使用 PKCS8 或 PKCS1 PEM，平台公钥使用 PEM。`.env.production` 与 `.dev.vars` 支持带引号、换行为 `\n` 的 PEM 字符串；服务端恢复真实换行。私钥仅用于服务端 RSA-SHA256 签名，不发送到 Pancake 或浏览器。

默认 `PAYMENT_PROVIDER=pancake`、`MODERATION_PROVIDER=pancake`；本地与 staging 预设 `PANCAKE_ENVIRONMENT=test`，production 预设 `prod`，须填写匹配的凭据。API 环境绑定在密钥上；正式启用需换用 prod 密钥与对应回调公钥，并设置 `PANCAKE_ENVIRONMENT=prod`。回调地址 `https://你的域名/api/webhooks/pancake`，使用原始请求体和 `X-Waffo-Signature` 验签。完整事件清单见 [配置指南](configuration.md)。

本地 HTTP 不能用于 Pancake 收银台的 successUrl。测试时使用自己的 HTTPS 测试站点，配置同一 APP_URL 和回调；不要只改返回链接而留下认证来源配置不一致。

真实联调需覆盖一次性付款、订阅首付/续费/取消、回调重放与乱序、失败付款、部分/全额退款，以及审核 allow/review/block/接口故障。当前只有本地协议测试，没有真实账户交易或已认证的 GraphQL schema 验证。模板尚不提供后台主动退款和拒付处理。

## 迁移与发布

```sh
npm run deploy:production
```

`deploy:staging` / `deploy:production` 会阻止目标环境不匹配、资源共用、占位域名、非 HTTPS 地址和占位 D1 ID，并执行类型检查、测试、构建及客户端秘密扫描。检查完成后会应用未执行的远端 D1 迁移，再发布 Worker。部署前还会只读取 Cloudflare Secrets 名称，阻止缺少认证或正式邮件凭据的发布。Secrets 值是否正确仍必须通过实际沙箱验证。不要启用对 SSR/账户接口的共享缓存。

数据库变更使用 `npm run db:generate` 后审阅 SQL，再应用迁移。`0001_integrity.sql` 是自定义触发器迁移；后续改动不得丢失账本、退款、并发任务与存储配额约束。Drizzle 元数据已同步到 `0004_round_ikaris`；0004 的闭户守卫同样不可丢失。生产迁移前应制定备份和回退方案。

正式发布前替换示例品牌、价格及法律页中的开发草稿，填写实际运营方、联系方式和账户数据删除流程。

官方参考：

- https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- https://better-auth.com/docs/integrations/tanstack
- https://docs.waffo.ai/api-reference/authentication
- https://docs.waffo.ai/api-reference/webhooks

## 页面与搜索索引

`APP_URL` 是唯一站点来源。正式环境且为 HTTPS 公网域名时，公开首页、价格、指南、六个工具页进入 sitemap，并输出 canonical 与分享元数据；预览和开发环境禁止索引。登录、重置密码、用户页和 API 带 noindex，且不在 sitemap 中。身份验证才是私有数据的访问边界，robots 不是权限控制。

## 本地开发排查

大量文件热更新期间，本机 Cloudflare 开发运行时曾出现 `fetch failed`，重启本项目开发服务后恢复，重新执行冒烟验证通过。遇到这类现象先重启该项目服务；没有关闭错误覆盖层或吞掉业务错误。

## 定时维护与健康检查

`wrangler.jsonc` 的本地、staging、production 均预设两个独立定时任务：`0 0 * * *` 每天 UTC 00:00（北京时间 08:00）处理付费年套餐和年付兑换的到期积分；`*/5 * * * *` 每 5 分钟处理 AI 超时恢复与过期认证数据清理，不发放权益积分。用户不需要打开网站。`maintenance_state` 分别以 `credits`、`routine` 记录最近开始、完成和状态，各自数据库租约防止重复执行，两项任务互不阻塞。定时任务失败应在 Workers 日志中排查；不会自动调用付费 AI，也不执行全量支付对账。

本地服务启动后可用 `curl 'http://127.0.0.1:4317/cdn-cgi/local/scheduled?format=json&cron=0%200%20*%20*%20*'` 触发验证。`/api/health` 检查 D1，成功 200、失败 503，不输出配置；建议上线后接入外部可用性监测。GitHub CI 文件已提供，尚未在远端执行。


### 月度积分自动发放

年付付款确认或年付兑换成功时保存 12 期发放计划。首期在生效时发放，后续按各自生效日期的 UTC 自然月计算（月末取目标月份最后一天）；并非每月 1 日统一发放。定时器每天查询已经到期且未发放的记录，正常情况下在起算时间后的下一批处理（24 小时内），队列积压或失败可能延迟；用户端明确标注每日处理。尚未到期的积分不会提前发放。每轮分别处理最多 100 笔付费分期与 100 笔兑换分期，未完成记录在后续运行继续处理。账本和已发放标记原子更新，重复触发不会重复加积分。

月付兑换只发一次当月积分；月付付费订阅在下一次续费付款确认后发放，定时器不会给未付款月份赠送积分。积分包一次到账。同套餐续期年付兑换从已有权益到期时间开始排期。定时维护不会自行延长套餐到期时间。

按模板流程填写目标环境域名、D1/R2 绑定、所需 Secrets 后运行 `npm run deploy:production`（测试站为 `deploy:staging`），部署脚本会先应用迁移，再携带该环境定时配置发布 Worker，无需单独创建外部定时服务或额外 Cron 密钥。部署前检查目标环境同时保留每日积分周期和五分钟 AI 恢复周期，构建后确认发布产物中的 `triggers.crons` 与源配置一致，避免定时器漏发。不要把仅上传静态页面当作完整部署。

Cloudflare 会按 Wrangler 配置创建/更新定时器，首次新增或修改可能需要最多 15 分钟传播。部署后在 Worker 的定时事件记录查看执行结果，并在日志查看 `maintenance` 的完成/失败状态；数据库 `maintenance_state` 按任务 ID 可查看最近开始、完成时间和状态，日志的 `job` 字段可区分积分与日常维护。线上生效情况必须在实际部署后确认。本地开发不会自动模拟云端周期，可用上面的本地 scheduled 地址手动验证；不暴露公网手动发积分接口。

官方依据：[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、[Scheduled Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)。

2026-10-16 本地验证：262 项测试、类型检查、完整构建与客户端密钥检查通过；staging / production 单独构建均通过定时配置一致性检查。本地 Cloudflare scheduled 入口以每日表达式触发返回 `outcome: ok`。回归验证五分钟维护不发积分、独立租约、每日到期发放、失败回滚后重试和重复运行不重复到账。本次未执行远端部署或云端定时事件。
