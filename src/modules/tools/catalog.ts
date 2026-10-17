import { unlocalizedPathname } from "@/i18n/routing";
import { posts } from "@/modules/blog/catalog";
export const tools = [
  {
    id: "copywriting",
    name: "AI 文案生成",
    category: "写作创作",
    description: "把一个想法，写成一段让人读得懂的好文案。",
    label: "描述你的产品或想法",
    placeholder: "介绍产品、目标读者，以及你想传递的信息……",
    example: "为一家周末开放的独立咖啡店，写一段温暖、自然的介绍。",
    sample:
      "周末，慢一点也很好。\n\n街角有一间小小的咖啡店，只在周末为你亮灯。带一本没读完的书，或者什么都不带。我们负责咖啡，你负责把时间留给自己。",
    icon: "pen",
    color: "green",
  },
  {
    id: "rewrite",
    name: "AI 文字润色",
    category: "写作创作",
    description: "保留你的意思，让表达更清楚、更顺畅。",
    label: "粘贴需要润色的文字",
    placeholder: "粘贴原文，也可以补充你希望调整的地方……",
    example:
      "我们这个工具主要就是帮助大家把会议里面说的东西记下来，然后就不用自己记笔记了。",
    sample: "这款工具帮你记录会议内容，让你专注讨论，省去手动整理笔记的时间。",
    icon: "wand",
    color: "purple",
  },
  {
    id: "summarize",
    name: "AI 内容摘要",
    category: "效率办公",
    description: "从长内容中提炼重点，快速抓住关键信息。",
    label: "粘贴需要总结的内容",
    placeholder: "粘贴文章、会议记录或其他文本……",
    example:
      "周一产品会上，团队决定先完成注册流程，再上线邮件提醒。设计稿周三交付，开发周五完成第一轮测试。支付功能暂时推迟到下一版，负责人还未确定。",
    sample:
      "核心结论\n先完成注册流程，再上线邮件提醒；支付功能延至下一版。\n\n时间安排\n• 周三：交付设计稿\n• 周五：完成第一轮开发测试\n\n待确认\n支付功能的负责人。",
    icon: "align",
    color: "blue",
  },
  {
    id: "translate",
    name: "AI 中英翻译",
    category: "语言翻译",
    description: "中英双向地道翻译，融入本地语言习惯与核心搜索关键词，拒绝生硬机翻。",
    label: "输入中文或英文",
    placeholder: "输入需要翻译的文字，自动识别中英文……",
    example: "感谢你试用我们的产品。如果遇到任何问题，欢迎随时告诉我们。",
    sample:
      "Thank you for trying our product. If you run into any issues, please feel free to let us know.",
    icon: "languages",
    color: "orange",
  },
  {
    id: "email",
    name: "AI 邮件助手",
    category: "效率办公",
    description: "撰写得体、清晰且有说服力的商务邮件与日常沟通函件。",
    label: "描述邮件背景与目的",
    placeholder: "收件人身份、邮件目的、关键信息与期望行动……",
    example:
      "给合作客户写一封项目进度汇报邮件，说明第一阶段已按期完成，邀请下周二开会评审。",
    sample:
      "尊敬的合作方：\n\n您好！向您汇报项目最新进展：第一阶段的核心功能已全部开发完成，内部测试指标均符合预期。\n\n为确保后续阶段顺利交接，诚邀您及团队参与下周二上午的评审演示会。感谢您的支持！",
    icon: "mail",
    color: "blue",
  },
  {
    id: "social",
    name: "AI 社媒文案",
    category: "写作创作",
    description: "针对小红书、微信朋友圈、X、LinkedIn 定制吸睛文案与标签。",
    label: "输入你的分享主题或核心想法",
    placeholder: "想要分享的日常、好物推荐、干货心得或活动预告……",
    example: "分享一份适合新手的远程办公效率工具清单，突出好用和免费。",
    sample:
      "💡 告别低效！给远程工作新手的5个宝藏生产力工具\n\n远程办公最怕手忙脚乱，今天整理了亲测超好用的轻量工具清单：\n\n1. 极简任务看板：清晰梳理每日优先级\n2. 智能文案助手：快速润色邮件与会议纪要\n3. 专注计时器：番茄工作法保持高效\n\n你最推荐哪个？在评论区聊聊吧～ ✨ #远程办公 #效率工具 #职场干货",
    icon: "message",
    color: "purple",
  },
  {
    id: "image",
    name: "AI 绘图生图",
    category: "图像视觉",
    modality: "image",
    description: "输入画面描述词，一键生成高清艺术图像与插画设计。",
    label: "描述你希望生成的画面内容",
    placeholder: "画面主体、艺术风格（赛博朋克/二次元/写实摄影）、光影氛围……",
    example: "赛博朋克雨夜街道，霓虹招牌倒影在湿润的沥青路面，胶片质感，8k高清细节。",
    sample: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1024&q=80",
    icon: "image",
    color: "pink",
  },
  {
    id: "video",
    name: "AI 视频生成",
    category: "视频动效",
    modality: "video",
    description: "文字驱动高清镜头运镜与电影级动态视频，支持多种运动轨迹。",
    label: "描述视频镜头画面与动态变化",
    placeholder: "主体动作、运镜方向（推镜/俯冲/环绕）、环境动态变化……",
    example: "航拍穿越晨雾缭绕的雪山峡谷，朝阳将金色光芒洒在山脊上，镜头缓慢向前推进。",
    sample: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
    icon: "video",
    color: "rose",
  },
  {
    id: "audio",
    name: "AI 音乐创作",
    category: "音频音乐",
    modality: "audio",
    description: "输入灵感描述与曲风标签，即刻创作伴奏旋律与氛围歌曲。",
    label: "描述音乐情绪、主题或输入歌词灵感",
    placeholder: "音乐风格（Lo-Fi/流行/纯音乐）、适用场景（专注/放松）、节奏快慢……",
    example: "温暖柔和的 Lo-Fi 咖啡馆背景音乐，舒缓的爵士钢琴与下雨白噪音，适合专注工作。",
    sample: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
    icon: "music",
    color: "teal",
  },
] as const;
export type Tool = (typeof tools)[number];
export type ToolId = Tool["id"];
export const getTool = (id: string) => tools.find((tool) => tool.id === id);
export const categories = [
  "全部工具",
  "写作创作",
  "效率办公",
  "语言翻译",
  "图像视觉",
  "视频动效",
  "音频音乐",
] as const;
export function safeReturnTo(value: unknown): string {
  if (typeof value === "string") value = unlocalizedPathname(value);
  if (
    typeof value === "string" &&
    [
      "/",
      "/dashboard",
      "/settings",
      "/account",
      "/subscriptions",
      "/billing",
      "/history",
      "/files",
      "/admin",
      "/admin/overview",
      "/admin/ai",
      "/admin/tasks",
      "/admin/ledger",
      "/admin/plans",
      "/admin/codes",
      "/admin/users",
      "/admin/billing",
      "/admin/audit",
      "/pricing",
      "/guide",
      "/blog",
      ...posts.map((post) => `/blog/${post.slug}`),
      "/terms",
      "/privacy",
    ].includes(value)
  )
    return value;
  if (
    typeof value === "string" &&
    tools.some((tool) => value === `/tools/${tool.id}`)
  )
    return value;
  return "/";
}
