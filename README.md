# ⚡️ 启航 AI SaaS 商业化启动模版 (Qihang AI SaaS Boilerplate)

> 🚀 **专为独立开发者与出海团队打造的高性能边缘全栈 AI SaaS 启动模版**  
> 基于 **TanStack Start (React 19)** 与 **Cloudflare Workers** 边缘运行时构建。内置 9 款开箱即用工具、四大出海支付通道、财务级防扣负积分账本、地道双语多语言、Token 成本精算大盘与 GEO/SEO 优化。  
> **告别 80% 的重复基建，克隆后只需专注你的 AI 提示词与业务逻辑，快速上线盈利。**

[⚡ 3分钟本地上手](#-3-分钟极速上手开箱即用) · [👑 后台业务管理](#-解锁管理员后台与业务管理admin) · [⚙️ 环境配置总表](#️-环境配置文件全景指南) · [🎯 模版二次开发](#-模版二次开发指南3-步定制你的专属产品) · [🚀 云端一键发布](#-云端一键发布上线staging-测试站--production-正式站) · [🌐 多语言国际化架构](docs/i18n.md)

---

## 🎯 为什么你需要这个模版？

开发一个可商业化变现的 AI SaaS，**80% 的时间往往耗费在与核心创意无关的基础设施上**：
- 搞定用户鉴权、会话保持与密码重置；
- 处理出海支付渠道申请、托管结账、Webhook 异步验签与掉单退款；
- 编写复杂的并发锁，防止用户多标签页并发扣成负积分；
- 适配国际化双语路由、搜索引擎 Meta、OpenGraph 与针对大模型爬虫的 GEO 索引；
- 解决冷启动延迟、跨区域服务器昂贵租赁与运维痛点。

### ⏳ 从零搭建 vs 采用本模版

| 模块任务 | 传统从零自建（约 3~4 周） | 采用本模版（几小时完成定制） |
| :--- | :--- | :--- |
| **边缘全栈底座** | 自行配置 React 19 + SSR + Cloudflare Workers 各种 polyfill 踩坑 | **开箱即用**：TanStack Start + Workers 全球毫秒级冷启动 |
| **积分与账本一致性** | 容易发生高并发超扣、负余额、网络超时吞积分 | **开箱即用**：Cloudflare D1 数据库触发器强一致性约束，生成预扣+失败秒退+超时巡检 |
| **国际支付渠道** | 面对 Stripe 个人出海难、商户对接签名繁琐 | **开箱即用**：内置 Waffo Pancake (默认 MoR，免海外主体)、Stripe、Creem、PayPal 四大渠道 |
| **出海网络与全球分发** | 需自行购买海外服务器、配置 CDN、处理跨国网络高延迟 | **开箱即用**：基于 Cloudflare Workers 全球 300+ 边缘节点，直连海外官方各支付与 AI 服务，全球毫秒级秒开 |
| **AI 交互与流式输出** | 需手写 SSE 协议解析、模型切换、降级重试与草稿恢复 | **开箱即用**：Vercel AI SDK 渐进式 Token 流式输出、多模态面板、草稿本地防丢 |
| **成本与 ROI 洞察** | 无法掌握用户调用花费了多少实际模型 API 费用 | **开箱即用**：自动记录 Token 数与微美元底座成本（`cost_micros`），大盘实时看收益 |
| **出海 SEO 与 GEO** | 手写 sitemap，缺少对 Perplexity/ChatGPT 爬虫的支持 | **开箱即用**：双语 Canonical/hreflang、Schema.org JSON-LD，率先支持 `llms.txt` GEO 标准 |

---

## 🧩 模版化设计核心特性

本项目遵循 **“高内聚、低耦合、开箱即用”** 的工业级模版设计原则：

- 📦 **开箱即用，零前置凭据体验**：本地预设 SQLite 数据库与随机安全密钥。即使尚未申请任何第三方 API Key，也可直接在本地运行完整的注册登录、工具预览、示例效果、暗黑主题切换与后台大盘。
- 🔧 **工具即配置，提示词即业务**：工具展示信息（`catalog.ts`）、专业私有提示词（`prompts.ts`）、前后端输入契约（`input.ts`）集中声明，不需要大改底层路由或数据库结构。
- 💳 **多支付即插即用**：通过 `PAYMENT_PROVIDER` 环境变量一键切换 Pancake / Stripe / Creem / PayPal，保留历史订单兼容性。
- 🔒 **客户端零密钥泄露**：强制 `@tanstack/react-start/server-only` 边界隔离，构建打包自动执行物理扫描，绝不让任何数据库私钥、支付密钥或 AI Key 泄露到前端。

---

## 🛠 核心技术栈（点击跳转官方文档）

本项目采用现代化边缘无服务器方案，摆脱传统服务器与 Docker 运维负担：

### 1. 全栈同构与前端框架
- **[TanStack Start](https://tanstack.com/start)**：基于 Vite 的新一代全栈 React 同构框架，支持全类型安全的服务端函数（Server Functions）、流式 SSR 与极简 API 构建。
- **[React 19](https://react.dev/)**：采用最新的 React 19 并发特性、Actions 与现代组件渲染机制。
- **[TanStack Router](https://tanstack.com/router)**：100% 类型推导路由引擎，深度定制了双语路径无感重写与搜索参数类型校验。

### 2. 边缘算力与数据存储
- **[Cloudflare Workers](https://workers.cloudflare.com/)**：全球边缘 Serverless 运行环境，全球 300+ 节点分布式就近响应，真正实现 `< 10ms` 零感冷启动。
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)**：Serverless 边缘 SQLite 数据库，内建数据库级触发器（Trigger），从底层杜绝并发超扣与负余额穿透。
- **[Drizzle ORM](https://orm.drizzle.team/)**：轻量级、类型安全的 TypeScript ORM，自带完整的 Schema 迁移与生成工具链。
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)**：兼容 S3 协议的高性能私有对象存储，零出网流量费，处理用户生成结果与导出文件。

### 3. 样式、组件与图标
- **[Tailwind CSS v4](https://tailwindcss.com/)**：最新版高性能原子化 CSS 引擎，默认提供现代精致的暗色主题与响应式布局。
- **[@base-ui/react](https://base-ui.com/)**：无样式、高度符合无障碍标准的现代 UI 原语库（用于全局模态弹窗、Popover、下拉选择等）。
- **[Lucide Icons](https://lucide.dev/)**：风格统一、体积轻量、辨识度极高的现代矢量图标库。

### 4. 身份认证与会话安全
- **[Better Auth](https://www.better-auth.com/)**：针对全栈应用深度优化的现代认证库，支持邮箱/密码登录、找回密码、邮箱验证重发与 Google OAuth 一键授权。

### 5. AI 模型引擎与安全合规
- **[Vercel AI SDK 4](https://sdk.vercel.ai/)**：统一的大模型调用抽象层，支持 Responses 与 Chat Completions 协议，提供文本渐进式流式输出（SSE）。
- **[OpenAI 兼容协议](https://platform.openai.com/docs/api-reference)**：支持任意兼容 OpenAI 协议的模型提供商，可在管理后台自由动态切换模型。
- **内容合规审核**：支持通过 Waffo Pancake 或 Creem 进行提示词合法性机审，明确合规才预扣积分调用底座模型。

### 6. 商业支付与对账体系
- **[Waffo Pancake](https://waffo.ai/)** *(默认)*：专为出海开发者打造的 MoR 聚合支付，支持支付宝、微信、国际卡，免去个人海外合规主体痛点。
- **[Stripe](https://stripe.com/)**：全球主流信用卡支付、周期性订阅管理与 Webhook 事件对账。
- **[Creem](https://creem.io/)**：轻量出海托管支付与数字商品订阅结算。
- **[PayPal](https://developer.paypal.com/)**：全球电子钱包结算，支持月付/年付周期性订阅。

### 7. 数据分析、SEO 与 GEO 优化
- **[Google Analytics 4 (GA4)](https://analytics.google.com/)**：支持转化漏斗与用户行为追踪。
- **[Umami Analytics](https://umami.is/)**：轻量、注重隐私的现代网站访问分析。
- **[llmstxt.org (GEO)](https://llmstxt.org/)**：面向生成式 AI 搜索引擎（Perplexity、ChatGPT、ClaudeBot）的知识索引标准规范。
- **[Schema.org JSON-LD](https://schema.org/)**：输出标准 `WebApplication` 结构化数据，提升搜索引擎权威度。

### 8. 邮件服务与工程化测试
- **[Resend](https://resend.com/)**：现代开发者邮件投递平台，处理事务性邮件。
- **[Vitest](https://vitest.dev/)**：全套 314 个单元与集成测试。
- **[TypeScript 5.8](https://www.typescriptlang.org/)**：全项目端到端强类型约束。

---

## ⚡ 3 分钟本地极速上手（开箱即用）

### 1. 环境准备
推荐使用 **Node.js 22.12+**（自带 `node:sqlite` 原生支持，已在 Node 22/24/26 验证通过）与 `npm`。

### 2. 极速启动 4 步走

```bash
# 1. 克隆模版代码仓库并进入项目根目录
git clone https://github.com/zgaobai/saas-template.git
cd saas-template

# 2. 安装项目依赖
npm install

# 3. 一键初始化本地环境（自动生成高强度安全随机密钥并迁移本地 SQLite 数据库）
npm run setup:local

# 4. 启动本地开发服务器
npm run dev
```

在浏览器打开 **`http://127.0.0.1:4317/`** 即可立即体验！

### 3. 开箱即用体验（零前置凭据）
即使尚未申请或填写任何外部 API Key，本地环境也已全套就绪，你可以立即体验：
- 🌓 **暗黑模式与双语切换**：无刷新切换深色/浅色主题，中英文 `/zh/` 与 `/en/` 智能路由无缝重写。
- 🤖 **AI 工具免登录预览**：首页多功能 AI 编辑器支持 Markdown 实时渲染、示例效果一键载入与流式生成效果预览。
- 🔐 **全套身份认证闭环**：在本地任意注册一个邮箱用户（例如 `test@example.com`），即刻登录并进入个人中心。
- 💎 **初始赠送积分与账本**：新注册用户自动获赠体验积分，数据库级触发器实时记录每笔账本明细。

---

## 👑 解锁管理员后台与业务管理（`/admin`）

> [!IMPORTANT]
> **🌟 本模版的核心设计原则：业务实体全部在后台可视化管理，环境文件零硬编码！**
> - **AI 大模型（DeepSeek、GPT、Claude、FLUX 等）**：在后台 `/admin/ai` 统一添加与管理，环境文件无需配置！
> - **商品与订阅套餐（价格、月/年付、积分额度）**：在后台 `/admin/plans` 统一配置与上下架，环境文件无需配置！

### 1. 本地如何解锁超级管理员权限？
1. 在浏览器前台注册一个普通账号（例如 `admin@example.com`）。
2. 在个人中心 `/account` 复制该用户的 `User ID`（如 `usr_xxxx`）。
3. 打开本地生成的 `.dev.vars`，将该 ID 填入 `ADMIN_USER_IDS` 并保存：
   ```ini
   ADMIN_USER_IDS=你的用户ID
   ```
4. 访问 **`http://127.0.0.1:4317/admin`** 即可直接进入管理后台！

### 2. 管理后台核心业务模块
- 🤖 **AI 模型动态管理 (`/admin/ai`)**：
  - 支持在线添加 DeepSeek V3、GPT-4o、Claude 3.5 Sonnet、FLUX 或任意第三方 OpenAI 兼容模型。
  - 在线填写 API Key 与中转端点，提供连通性一键测试，并支持设置默认模型。
  - 所有配置自动加密存入数据库，**环境配置文件中完全无需填写 AI 模型与 Key**！
- 🛍️ **商品与套餐配置 (`/admin/plans`)**：
  - 系统初始化已默认赠送 3 款开箱即用的预设商品（体验版、创作者订阅、灵感补给包）。
  - 支持在线新增套餐、修改月付价格与年付折扣价（年付全年实付，系统按月自动发放 12 次积分）。
  - 一键开启/关闭套餐，前台定价页（`/pricing`）毫秒级实时生效。**环境配置文件中完全无需配置商品**！
- 📊 **全局运营大盘 (`/admin/overview`)**：用户总量、总收益走势图、今日活跃、Token 调用与微美元（`cost_micros`）成本精算。
- 👥 **用户与积分管理 (`/admin/users`)**：查看用户状态、封禁/解封、人工手动调整积分余额。
- 🎟 **充值卡密与兑换码 (`/admin/codes`)**：在线批量生成高强度加密兑换码（支持导出），方便在社群、发卡平台进行预付销售。
- 📑 **不可篡改审计日志 (`/admin/audit`, `/admin/ledger`)**：全站每一笔充值、扣费、退款双录流水防篡改追溯。

---

## ⚙️ 环境配置文件全景指南

本项目采用 **“基础设施与通信凭据归环境文件，业务实体归管理后台”** 的清晰边界：
- **本地开发**：`.dev.vars`（模版：`.env.example`）👉 本地 SQLite 隔离
- **测试/预发布**：`.env.staging`（模版：`.env.staging.example`）👉 独立测试站 D1 库与沙箱支付凭据
- **线上正式**：`.env.production`（模版：`.env.production.example`）👉 正式域名与生产商户凭据

模版文件中每个参数均附有详尽中文注释，参数分类总表如下：

| 分类模块 | 参数名 | 属性 | 说明与获取方式 |
| :--- | :--- | :---: | :--- |
| **1. 域名与 Cloudflare 资源** | `APP_URL` | **必填** | 站点完整 HTTPS 访问域名（如 `https://yourdomain.com`，末尾严禁加斜杠 `/`），用于身份回调与 Webhook。 |
| | `D1_DATABASE_ID` | **必填** | Cloudflare D1 数据库 UUID（执行 `npx wrangler d1 create <db-name>` 后的输出）。 |
| | `R2_BUCKET_NAME` | 选填 | Cloudflare R2 对象存储桶名称（用于用户生成物与导出文件存储）。 |
| **2. 安全与管理员权限** | `BETTER_AUTH_SECRET` | **自动补齐** | 会话 Cookie 签名加密密钥。留空即可，部署脚本会自动生成 48 位高强度密钥写回文件。 |
| | `REDEMPTION_ENCRYPTION_KEY` | **自动补齐** | 兑换卡密 AES-256-GCM 加密密钥。留空即可，部署脚本会自动生成 64 位 Hex 密钥写回文件。 |
| | `ADMIN_USER_IDS` | 选填 | 管理员 User ID 白名单（多个逗号分隔）。用于解锁 `/admin` 超级管理后台。 |
| **3. 事务性邮件服务** | `RESEND_API_KEY` | **必填** | Resend 邮件发送 API Key（以 `re_` 开头，用于注册验证码与找回密码）。 |
| | `EMAIL_FROM` | **必填** | 发信人邮箱地址（必须在 Resend 控制台 Domains 验证通过）。 |
| | `GOOGLE_CLIENT_ID` | 选填 | Google OAuth 快捷登录凭据（留空则前台自动隐藏谷歌登录按钮）。 |
| | `GOOGLE_CLIENT_SECRET` | 选填 | Google OAuth 客户端密钥。 |
| **4. 商业支付集成**<br>*(按选用渠道四选一)* | `PAYMENT_PROVIDER` | **必填** | 前台默认支付通道：`pancake`（默认推荐，MoR 聚合支付）/ `stripe` / `creem` / `paypal`。 |
| | `PANCAKE_*` | 条件必填 | Waffo Pancake 商户凭据（`MERCHANT_ID`, `PRIVATE_KEY`, `WEBHOOK_PUBLIC_KEY`, `STORE_ID`）。支持可选 `PANCAKE_BASE_URL` 覆盖。 |
| | `STRIPE_*` | 可选通道 | Stripe 密钥（`SECRET_KEY`, `WEBHOOK_SECRET`）。支持可选 `STRIPE_BASE_URL` 覆盖。 |
| | `CREEM_*` | 可选通道 | Creem 托管支付凭据（`API_KEY`, `WEBHOOK_SECRET`）。支持可选 `CREEM_BASE_URL` 覆盖。 |
| | `PAYPAL_*` | 可选通道 | PayPal REST App 凭据（`CLIENT_ID`, `CLIENT_SECRET`, `WEBHOOK_ID`）。支持可选 `PAYPAL_BASE_URL` 覆盖。 |
| **5. 网站访问统计分析** | `GA_MEASUREMENT_ID` | 选填 | Google Analytics 4 衡量 ID（仅在生产环境 HTTPS 且可被索引时自动注入，本地绝不产生脏数据）。 |
| | `UMAMI_WEBSITE_ID` | 选填 | Umami 统计 Website ID（轻量注重隐私）。 |

> [!TIP]
> **关于网络专线与 Base URL 覆盖**：
> 本项目部署在 Cloudflare 全球 300+ 边缘网络上，对 OpenAI、Stripe、PayPal、Creem、Pancake 的请求均由海外边缘节点直接发出，天然具备极速的全球连通性与低延迟，**无需配置任何反向代理或专线**。所有的 `*_BASE_URL` 均为**可选覆盖项**（默认留空即可直连官方），仅在本地离线 Mock 测试或自建网关时按需指定。

---

## 🎯 模版二次开发指南（3 步定制你的专属产品）

拿到模版后，只需完成以下 3 步即可快速衍生出你的商业站点：

### 第 1 步：品牌与基本信息换新
打开 [`src/site.ts`](src/site.ts)，修改你的产品名称与信息：
```ts
export const site = {
  name: "你的产品名", // 例如 "QuickCopy AI"
  description: "一句话阐述你的产品核心卖点，赋能用户日常创作与效率。",
  supportEmail: "support@yourdomain.com",
} as const;
```
- 替换 `public/favicon.svg` 为你的站点 Logo。
- 全站导航栏、页面 `<title>`、页脚版权、使用条款、SEO 结构化数据会自动同步更新。

### 第 2 步：增删或定制你的 AI 工具与提示词
1. **工具目录展示**：打开 [`src/modules/tools/catalog.ts`](src/modules/tools/catalog.ts)，在 `tools` 数组中修改、添加或删除工具（工具 ID、展示名称、分类、输入提示占位符、预置示例与效果）。
2. **编写私有提示词**：打开 [`src/modules/tools/server/prompts.ts`](src/modules/tools/server/prompts.ts)，在 `instructions`（中文）与 `englishInstructions`（英文）中加入你的专业 System Prompt。
3. **输入契约校验**：在 [`src/modules/tools/input.ts`](src/modules/tools/input.ts) 的 `toolId` Zod 枚举中加入你的工具 ID。
4. **多语言词条**：若为中文新工具添加了专属描述，在 [`src/i18n/en.json`](src/i18n/en.json) 补充对应的地道英文表达即可。

### 第 3 步：运行全量质量自检
在准备上线前，执行标准质检：
```bash
npm run check
```
该命令会自动按顺序执行：**TypeScript 严格类型检查 + 全套 314 项自动化测试 + 生产环境打包构建 + 客户端密钥防泄露物理扫描**。

---

## 🚀 云端一键发布上线（Staging 测试站 / Production 正式站）

基于 Cloudflare Workers 边缘架构，全球 300+ 节点秒级发布，享有 `< 10ms` 冷启动优势与免服务器运维：

### 第 1 步：准备 Cloudflare 云端资源（首次执行）
在终端授权登录并创建边缘数据库与存储桶：
```bash
# 1. 登录 Cloudflare
npx wrangler login

# 2. 创建测试环境资源（记录输出中的 database_id）
npx wrangler d1 create qihang-db-staging
npx wrangler r2 bucket create qihang-files-staging

# 3. 创建生产环境资源（记录输出中的 database_id）
npx wrangler d1 create qihang-db-production
npx wrangler r2 bucket create qihang-files-production
```

### 第 2 步：复制并填写对应的环境配置文件
- **测试站**：`cp .env.staging.example .env.staging`，填入测试站域名、测试 D1 ID 与沙箱商户凭据。
- **生产站**：`cp .env.production.example .env.production`，填入正式域名、生产 D1 ID 与线上商户凭据。

### 第 3 步：一键安全发布
```bash
# 🚀 发布到测试站
npm run deploy:staging

# 🚀 发布到生产站
npm run deploy:production
```

> [!IMPORTANT]
> **企业级自动化流水线**：
> `deploy` 命令会自动串联执行以下完整工作流，无需人工干预：
> 1. **配置自动同步**：自动读取对应的环境文件，更新 `APP_URL` 与数据库绑定；
> 2. **密钥批量加密上传**：通过 Cloudflare 官方 `wrangler secret bulk` 秒级批量加密同步所有非空密钥；
> 3. **交付级严苛质检**：执行全量 TypeScript 校验与 314 项自动化测试；
> 4. **生产构建与物理扫描**：Vite 构建轻量同构产物，并物理扫描确保零私钥泄露给客户端；
> 5. **数据库自动迁移**：自动将最新 D1 Schema 迁移应用至云端；
> 6. **零停机分发**：秒级同步至 Cloudflare 全球 300+ 边缘节点。

> [!TIP]
> **日常修改密钥批量同步**：
> 任何时候在配置文件中修改或补充了密钥，只需运行 `npm run env:sync:staging`（测试）或 `npm run env:sync:production`（生产），1 秒内全自动批量加密同步至 Cloudflare。

---

## 📜 常用命令速查

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 启动本地 Vite 开发服务器（端口 4317） |
| `npm run setup:local` | 自动生成本地密钥并初始化本地 SQLite 数据库 |
| `npm run deploy:staging` | **一键测试站发布**（同步测试配置、314 项质检、自动数据库迁移并发布） |
| `npm run deploy:production` | **一键生产站发布**（同步正式配置、314 项质检、自动数据库迁移并发布） |
| `npm run env:sync:staging` | 将 `.env.staging` 中的配置与密钥批量加密同步至 Cloudflare 测试环境 |
| `npm run env:sync:production` | 将 `.env.production` 中的配置与密钥批量加密同步至 Cloudflare 生产环境 |
| `npm run check` | **交付级质检**（TypeScript + 314 项测试 + 生产构建 + 私钥防泄露扫描） |
| `npm run test` | 快速执行 Vitest 全量单元/集成测试 |
| `npm run config:check` | 检查当前配置项缺项（安全诊断，不泄漏明文） |
| `npm run db:migrate` | 应用本地数据库迁移 |
| `npm run security:check` | 扫描客户端产物，确保零第三方 Secret 混入前端 |
| `node scripts/smoke-local.mjs` | 本地端到端自动化冒烟测试（模拟独立用户全流程） |

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源，欢迎自由二次开发与商业化使用。  
如有问题或灵感建议，欢迎前往 [GitHub 仓库](https://github.com/zgaobai/saas-template) 提交 [Issue](https://github.com/zgaobai/saas-template/issues) 或点亮 Star 支持！🌟

