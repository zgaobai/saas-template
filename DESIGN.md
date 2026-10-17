---
name: 启航 AI
description: 中文 SaaS 官网与工具工作台，共享黑白中性色和橙色操作系统
colors:
  paper: "#0b0b0c"
  surface: "#111113"
  surface-raised: "#18181b"
  ink: "#f5f5f5"
  muted: "#a2a2ab"
  line: "#29292e"
  accent: "#fa9167"
  accent-solid: "#c83b0b"
  accent-hover: "#af3107"
  soft: "#1c1715"
  focus: "#fb9b77"
  positive: "#7edda9"
  positive-bg: "#14261c"
  danger: "#ffb0a4"
  danger-bg: "#301c1a"
  selection: "#632d1a"
  paper-light: "#fff"
  surface-light: "#fafafa"
  surface-raised-light: "#f3f3f4"
  ink-light: "#19191c"
  muted-light: "#63636b"
  line-light: "#e4e4e7"
  accent-light: "#b9360d"
  soft-light: "#fff5ef"
  focus-light: "#bd3b12"
  positive-light: "#236b43"
  positive-bg-light: "#eef8f1"
  danger-light: "#a13224"
  danger-bg-light: "#fff0ec"
  selection-light: "#ffdbc8"
  on-action: "#fff"
typography:
  display:
    fontFamily: '"Noto Sans SC Variable", sans-serif'
    fontSize: "clamp(42px, 4.8vw, 66px)"
    fontWeight: 720
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Noto Sans SC Variable", sans-serif'
    fontSize: "clamp(25px, 3vw, 36px)"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-0.03em"
  title:
    fontFamily: '"Noto Sans SC Variable", sans-serif'
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Noto Sans SC Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  introduction:
    fontFamily: '"Noto Sans SC Variable", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.9
  label:
    fontFamily: '"Noto Sans SC Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.65
  button:
    fontFamily: '"Noto Sans SC Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  badge: "5px"
  chip: "7px"
  control: "8px"
  icon: "9px"
  card: "12px"
  workspace: "14px"
  announcement: "30px"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  feature-gap: "48px"
  section-mobile: "65px"
  directory-top: "88px"
  section-desktop: "110px"
components:
  button-primary:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.on-action}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-raised}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  button-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    width: "100%"
  navigation:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    height: "76px"
  category-chip:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "9px 16px"
  category-chip-selected:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
  tool-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  price-card-featured:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "28px"
  product-window:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace}"
---

# Design System: 启航 AI

## Overview

**Creative North Star: "清晰的创作入口"**

以用户指定的 TanStarter 官网为视觉参考：中文大标题、充足留白、黑白中性色、橙色操作入口，以及能切换内容的产品演示。界面直接、清楚、克制，默认深色，提供浅色切换；不再使用原先米白绿色工具导航的视觉方向。

官网负责介绍产品，工具与账户页面负责完成操作。两类页面共用字体、颜色、边界和组件状态，操作页面采用更紧凑的密度。品牌暂用可替换的“启航”，产品事实以 PRODUCT.md 为准。

**Key Characteristics:**

- 默认深色、可切换浅色，主题覆盖公开页、工具页和账户页。
- 橙色实底用于主要操作，橙色文字用于强调与选中状态。
- 居中的中文标题配合双入口，真实界面演示承担主要视觉内容。
- 细边界与相邻表面色区分层级，卡片保持平直，不添加装饰性光晕。

## Colors

色彩以近黑、白和灰建立阅读层级，橙色承担操作与少量强调。前置 token 表为规范值；`src/styles/theme.css` 是代码来源。无后缀颜色为默认深色，`-light` 表示浅色替换值；两个主题相同的操作色不重复定义。组件前置 token 描述默认主题，运行时通过同名 CSS 变量切换。

### Primary

- **实橙操作色**（accent-solid）：主要按钮与品牌图标；悬停使用 accent-hover，文字使用 on-action。
- **柔橙强调色**（accent）：文字链接、功能图标与选中项文字。浅色使用 accent-light，避免把深色强调值直接用于白底文字。
- **暖色选中表面**（soft）：演示工具与工作台导航的选中背景；focus 用于焦点边界和可见焦点，selection 用于选中文字。

### Neutral

- **近黑画布**（paper）：页面底色、工具卡、演示输入结果分区的基底；浅色替换为白色画布。
- **低阶表面**（surface）：次按钮、推荐套餐、表格表头与账户导航。
- **抬升表面**（surface-raised）：悬停、徽章和图标容器，依靠明度而非阴影表现层级。
- **主文字**（ink）、**次文字**（muted）、**边界**（line）：分别用于标题及正文、说明及导航、分割线及容器边框。

状态色 positive / positive-bg 用于成功提示，danger / danger-bg 用于错误提示和危险按钮；它们是状态语义，不作为第二套品牌色。

**The Semantic Theme Rule.** 新组件使用现有语义变量；主操作实底与强调文字各用自己的角色，不互换。

## Typography

**Display Font:** 自托管 Noto Sans SC Variable，回退 sans-serif。
**Body Font:** 同一字体，不引入另一套展示字体或图标字体。

标题以偏紧字距和较高字重形成层级，中文正文保持自然行距。前置 token 分别记录首页主标题、分区标题、功能标题、正文、介绍和标签，不代表所有页面标题都套用首页尺度。

- **Display**：首页两行标题，最大宽度（950px）；移动端改为 `clamp(32px, 8.3vw, 43px)`、行高（1.4）。
- **Headline**：官网分区标题；移动端固定（25px）。
- **Title**：功能标题；工具卡标题（16px），普通操作页 h1（36px / 600 / 1.4）。
- **Body / Introduction**：正文与首屏介绍区分层级。首屏介绍最大宽度（780px），移动端（13px / 1.9），最大（30ch）。功能段落（13px / 1.9），示例结果（12px / 1.95）。
- **Label**：标签、导航与辅助说明以小字号减轻视觉重量，不把整段正文降为提示文字。
- **数字**：套餐价格（44px / 600）及余额使用等宽数字，便于比较。

## Layout

公共容器宽度为 `min(1200px, calc(100% - 64px))`；视口不超过（760px）时两侧各留（18px）。产品演示、工具卡区域和价格区域最大（1080px），FAQ 最大（800px）。官网首屏居中，标题、介绍、双按钮和事实提示后接产品演示；再进入工具、功能、价格、FAQ 与页脚。

官网桌面首屏上、下内边距分别（65px / 48px）。工具区顶部（88px），后续主要分区顶部（110px）；移动端工具区（55px），主要分区（65px）。间距遵循内容层级，保留源码中按钮、卡片和表单的具体数值，不强行归并成单一网格倍数。

- 桌面演示为（190px / 1fr / 1.1fr）三列；不超过（1000px）改为（160px / 1fr / 1fr）；不超过（760px）为单列，工具选项变为横向条。
- 工具卡桌面三列、间隔（16px）；不超过（900px）为两列，不超过（700px）为单列。功能三列、不超过（760px）为单列；价格三列、不超过（700px）为单列。
- 官网导航高度（76px）；不超过（1000px）压缩间距并隐藏次要导航项；不超过（760px）高度（66px），导航由菜单按钮展开。菜单保持可见状态语义，点击导航项关闭。
- 账户布局桌面侧栏（244px），不超过（1100px）缩至（210px）；不超过（700px）时，个人账户与后台均使用菜单按钮展开纵向导航。通用编辑器在（1100px）折为单列；公开工具编辑器在大于（900px）时保持两列。
- 页脚桌面为（2.2fr / 1fr / 1fr / 1fr），移动端品牌说明跨整行，下方三列链接。

## Elevation & Depth

当前组件以表面明度和（1px）边界表现层级；工具卡悬停只改变表面和边界，不上移、不添加投影。产品窗口与编辑器通过分栏边界和背景分区形成深度。主题文件虽定义 shadow 变量，但当前样式没有使用它；不得把该预留值描述为已使用的投影规范。

**The Quiet Surface Rule.** 默认保持平直表面，以边界、留白和明度分层，不增加装饰性光晕。

## Shapes

控件与品牌图标使用 control 圆角；分类和语气选项使用 chip 圆角；工具与价格卡使用 card 圆角；产品演示与工作区使用 workspace 圆角并裁切内容。主题按钮为圆形，公告条为长胶囊。图标采用简洁描边 SVG，常见尺寸（14–24px），不可用客户头像或外部品牌标识作为装饰填充。

## Components

### Buttons

清晰、紧凑、直接。公共按钮最小高度（44px），默认内边距见前置 token；小按钮（38px）、头部按钮（35px）、首屏按钮（43px）由所在页面明确覆盖。主按钮实橙白字；次按钮使用表面与细边界，悬停改用抬升表面和 muted 边界。Ghost 使用透明底，最终公共样式的文字为 ink，悬停使用 soft；危险按钮使用 danger-bg 与 danger。

按钮背景与边界变化（0.16s）。禁用态不透明度（0.55），鼠标为不可用；未定义独立按下变形。全局键盘焦点为 focus 色实线（3px）、外移（4px）。

### Chips / Tags

分类选项默认为透明底与 muted 文字，选中为 surface-raised 与 ink，悬停为 surface。语气选项保留单选控件，选中为 soft 背景、accent-solid 边界和 accent 文字。纯展示徽章使用 surface-raised / muted、badge 圆角和（4px 8px）内边距。

### Cards / Containers

工具卡使用 paper 背景、line 边框，默认内边距（24px），移动端（23px）；标题前的图标容器（40px）方形，带细边界。悬停改为 surface 背景与 muted 边框。价格卡默认同样平直，推荐套餐使用 surface 背景和 accent-solid 边框；桌面内边距（28px），移动端（26px）。

### Inputs / Fields

输入框与文本域使用 paper 背景、ink 文字、line 边界，最小高度（46px）。标签（13px / 500）与字段间距（8px）。输入焦点改为 focus 边界，不加阴影；当前输入样式取消默认 outline，因此不要将按钮焦点环误记为输入框已实现状态。只读字段保持 surface-raised 背景。文本域默认最小高度（210px），移动端（185px），允许纵向调整。错误与成功消息使用对应状态色对，并保留文字说明。

### Navigation

官网导航使用 muted 文字，悬停改为 ink；头部为普通文档流中的相对定位元素，不是粘性导航。主题切换使用圆形描边按钮，首次加载读取本机 `qihang-theme`，无已保存浅色偏好时为深色。账户导航选中为 soft 背景与 accent 文字，悬停用 surface-raised。

### Product Demo / FAQ

产品演示是实际可切换的预置内容：工具选项使用 `aria-pressed`，结果区使用 `aria-live="polite"`，复制有成功图标和失败文字。窗口保留“预置示例”说明，不伪装实时生成。桌面窗口工具栏（48px），移动端（40px）；每个输入、结果区域桌面内边距（26px），较窄视口（21px）。

FAQ 使用原生 details / summary；条目以底边界分隔，展开时加号旋转（45deg）。锚点平滑滚动配合顶部预留（100px）。系统请求减少动态效果时关闭平滑滚动，并将动画与过渡时长降为（0.01ms）。

## Do's and Don'ts

### Do:

- Do 复用语义主题变量；新增页面同时适配深色和浅色。
- Do 在主次按钮之间保持明确层级，次按钮使用中性表面和细边界。
- Do 使用自托管中文字体，按实际响应式规则处理标题、导航和多列内容。
- Do 将预置内容标明为示例，保留复制反馈、错误提示与键盘焦点。
- Do 在工具页与账户页继续使用官网的颜色、圆角和基础组件。

### Don't:

- Don't 恢复已被替换的米白绿色视觉方向。
- Don't 为界面添加无依据的客户头像、客户评价、营收、销量或成功率。
- Don't 将示例结果表现为已经发生的实时生成或已成功付款。
- Don't 把颜色常量散落到新组件中，或用大面积橙色替代中性阅读表面。
- Don't 用悬浮阴影、光晕或自动循环动画替代现有的细边界和内容层级。

## 后台与账户中心密度（2026-10-16）

操作界面使用 224px 侧栏与 60px 顶栏，桌面控件高 40px，手机触控恢复 44px；标题 27px（手机 24px）、字段和正文 12–13px、表格辅助信息 11px。这些是操作界面的有意密度覆盖，不改变官网的展示字号。分段切换使用浅橙背景、橙色文字与底部标记强调选中态。

下拉菜单复用 Base UI Select，深浅色同源，支持键盘操作。长邮箱、流水编号、任务编号、兑换码编号统一用 CompactValue：160–230px 展示范围，省略号，悬停提示和行内复制原值，不展开或重复显示编号；不改写底层内容。表格日期和时间拆为两行，金额列保持完整。移动端只允许表格容器横向滚动，页面不因长编号而溢出。

用户列表把运营信息放在同一行：邮箱、注册方式、验证、账号状态、余额与注册时间。详情使用独立页面 `/admin/users/$userId`，页首提供返回用户列表入口；页内切换记录、分页及处理用户操作，记录分类写入 URL，刷新后保留选中项。桌面账户信息分四列，窄屏分两列。选中 Tab 以 accent 文字、soft 背景和 2px 底部标记区分，保留 aria-pressed，切换后仍有持久选中态。

创建兑换码使用居中 520px 弹窗，最大高度随视口收缩，表单可滚动；创建成功后在弹窗和管理员列表中显示完整兑换码与复制入口。后台列表统一将查询、重置、刷新并排放置，分页只负责翻页。

后台侧栏不显示“网站管理”分组标题，菜单直接接在品牌和返回网站入口下方。

用户详情的任务、积分流水、订单、兑换记录均复用后台 table-wrap/table 样式与 AdminPagination。空列表保留表头；任务内容在对应行下展开。发放积分、停用/恢复账号复用 Modal，表单显示目标用户和操作原因，提交中禁止关闭或重复操作。

用户详情的发放积分、停用/恢复按钮与用户名和邮箱同一行，靠右对齐；窄屏空间不足时自然换行，不在账户数据和记录表格之间单独占一行。

后台数据列表无数据时保留表头和表格边界，使用 TableEmptyRow 跨列显示空状态，保持生成任务、订单、订阅及其他后台列表的布局一致。

用户详情增加订阅记录 Tab 和表格，与订单、兑换记录分开。账号操作中，发放积分使用带图标的品牌色主按钮，停用账号使用带图标和边框的危险按钮；恢复账号使用带图标的次按钮。

兑换码管理将名称与“兑换码”拆成独立列。新码为 6 位大写字母数字，完整显示并有“复制兑换码”按钮；不展示内部编号。每码仅限一人兑换一次，兑换后继续展示完整原码和复制按钮，同时标记已兑换状态；后端阻止重复发放；旧码未保留原文时明确标记。


后台用户身份以邮箱为主、昵称为辅：用户、任务、订单、订阅、积分流水、兑换记录及操作记录共用邮箱优先展示。用户详情和发放/停用弹窗同样先显示邮箱，不显示用户内部编号；缺失邮箱明确标记不可用。任务、订单、订阅及流水等业务记录编号仍保留展示与查询能力，不改变底层主键或关联。


兑换记录总列表与用户详情共用五列表格：兑换人邮箱、完整兑换码（支持复制，附名称）、兑换内容（套餐及积分）、权益到期和兑换时间。历史未存原文的码明确标记。服务端仅管理员可读取解密后的码，不返回密文或哈希；总列表支持按完整邮箱或兑换码查询，用户详情保持限定该用户的游标分页。


套餐配置使用列表加添加/编辑弹窗，同类套餐可有多个。订阅套餐共用名称、功能和每月积分，前台在同一套餐中切换月付/年付；积分包单独展示。年付卡片展示折合月价、全年实付与相对逐月付款的优惠，明确说明按月发放 12 期。后台同一套餐内启用年付价格，按周期分别绑定支付商品。用户信息显示年付购买/兑换的下一期积分数量和发放时间。支付绑定为管理员专属配置，字段按渠道标明 Product / Price / Plan ID，密钥继续使用服务端环境配置。

价格展示补充：顶部使用月付/年付胶囊切换，年付旁展示由实际价格计算的优惠比例；多套餐优惠不同时标注“最高约省”。年付卡展示原月价划线、折合月价、全年实付与年度节省金额。积分包在订阅列表下方独立展示，始终可见，不参与周期切换。订阅套餐使用 `PlanCard`，积分包使用紧凑的 `CreditPackCard`，两者共享 `PlanPurchase` 购买入口；积分包下单不携带订阅周期。


价格区布局（2026-10-16）：套餐卡片按 328px 基准宽度自动换行，整组始终居中；名称、价格和优惠居中，权益列表左对齐以便阅读，主要操作保持底部对齐。积分包在下方独立居中，桌面横向紧凑排列名称、积分、价格和购买按钮，不重复展示描述与功能清单；手机端按钮另占一行。多个积分包自动换行居中。保留月付/年付切换、真实计算的优惠、年度总价和按月发积分说明。

本价格区局部字号沿用 44px 主价格、13px 权益/操作文字，20px 套餐标题、24px 积分包数量与价格，属于有意的内容层级，未扩展全站字体体系。胶囊切换沿用现有视觉。已检查 1280px、820px、390px 布局以及深浅主题，未发现水平溢出；262 项测试、类型检查、构建与客户端密钥扫描通过。


价格区追加调整：年付节省比例使用 Tab 右上角的小角标，脱离文字行，按月/按年按钮等宽。积分包改为 240px 基准宽度的纵向小卡片，名称、积分数量、一次性价格、购买按钮上下居中；多卡居中换行，继续保持在订阅套餐下方。覆盖此前积分包横向排列约定。

## 个人账户信息结构（2026-10-16）

“我的账户”默认进入 `/account`。导航分为账户概览、套餐与订单、积分流水、任务列表、账户设置，管理员另有管理后台入口。账户概览先显示身份，再用共享 `AccountSummary` 展示积分、套餐与权益到期，下期积分信息独立提示；下方提供常用操作入口。个人账户内容最大宽度 1080px，沿用现有黑白橙色和紧凑排版。

套餐与订单独立在 `/subscriptions`，订阅、订单、兑换记录使用带持久选中态的 Tab 和表格，空状态保留表头。兑换权益、取消续费使用共享弹窗。套餐记录分页固定每页 25 条，任务列表固定每页 20 条；刷新在工具栏、分页在表格下方。用户端不展示手动核对付款。任务列表使用表格和详情弹窗，取代旧折叠卡片。个人资料与密码表单仅放账户设置，注销区域与普通修改表单分开。手机端菜单默认收起，点击顶部菜单按钮展开纵向导航，选择页面或按 Escape 后收起，积分和套餐摘要两列，到期信息占整行；记录表格可在自身容器内横向滚动。


积分流水页使用独立 `CreditLedger` 组件：当前余额以紧凑横栏展示；收支概况使用三列定义列表，7/30/90 天选择器只控制概况；下方“全部历史流水”通过类型按钮筛选，每页 25 条，刷新置于工具栏。统计说明明确按各笔入账时间计算，不再用可能跨期的预扣减退回推断任务净消耗。流水类型和原因合并展示，金额使用正负号及等宽数字，编号保留复制。空列表仍保留表头；手机端类型按钮两列排列，表格自身横向滚动。


手机导航更新：账户和管理后台共用折叠导航，按钮标注展开状态并关联菜单区域；隐藏时菜单不参与键盘导航。返回网站仍在品牌旁，桌面侧栏不变。


## 中英文界面（2026-10-16）

保留现有黑白橙色与组件体系。语言选择在官网和账户/后台顶部，紧跟明暗模式按钮；手机端也直接显示，无需展开导航菜单。英语文案允许自然换行，首页英文标题使用较紧凑的字号范围；手机导航仍以菜单按钮收起。语言按钮使用带“文 / A”的 Languages 图标，与明暗模式按钮保持一致的圆形边框；点击打开下拉菜单，提供简体中文和 English；当前语言通过勾选和强调色标明，支持键盘选择与 Escape 关闭。用户资料、输入与生成记录保持原文；只翻译界面和明确的模板展示内容。日期格式随语言变化，时区与计费事实不变。


语言地址采用 `/zh/`、`/en/` 前缀，切换保持所在页面与其他参数，替代之前的 lang 查询参数方案。站内导航与登录回跳同步使用语言路径；API、回调、服务端函数和静态资源保持根地址。
