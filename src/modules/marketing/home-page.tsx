import { useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { FeatureOverview } from "./features";
import { FaqSection } from "./faq";
import {
  Check,
  PenLine,
  Megaphone,
  Briefcase,
  Languages,
  Sparkles,
  ArrowRight,
  Play,
  Star,
  Quote,
  ShieldCheck,
  Zap,
  Users,
} from "lucide-react";
import { ProductDemo } from "./product-demo";
import { VideoShowreel } from "./video-showreel";
import { ToolCatalog } from "@/modules/tools/components/tool-catalog";
import { Pricing } from "@/modules/billing/components/pricing";
import { tools } from "@/modules/tools/catalog";
import type { Plan } from "@/modules/billing/plans";

export function HomePage({
  signedIn,
  paymentsReady,
  paymentsPaused = false,
  plans,
  paymentProviders = [],
}: {
  signedIn: boolean;
  paymentsReady: boolean;
  paymentsPaused?: boolean;
  plans: Plan[];
  paymentProviders?: (
    | "pancake"
    | "stripe"
    | "creem"
    | "paypal"
    | "anyway"
  )[];
}) {
  const { t: tr } = useI18n();
  const freeCredits = plans.find((p) => p.mode === "free")?.credits ?? 0;

  return (
    <>
      {/* Hero Section */}
      <section className="saas-hero container">
        <HomeSectionLink section="tools" className="hero-announcement">
          <span className="hero-badge-dot" aria-hidden="true" />
          <span>{tr("{0} 款 AI 工具，开启下一次创作", [tools.length])}</span>
          <ArrowRight size={13} className="hero-announcement-arrow" />
        </HomeSectionLink>

        <h1>
          <span>{tr("少一点重复工作，")}</span>
          <br />
          <span className="hero-title-accent">{tr("多一点创作可能。")}</span>
        </h1>

        <p>
          {tr("写文案、润色、摘要、翻译。把日常文字工作交给 AI，")}
          <br className="desktop-break" />
          {tr("让你的想法，更快成为可以使用的内容。")}
        </p>

        <div className="saas-hero-actions">
          <HomeSectionLink
            section="tools"
            className="button button-primary hero-btn-primary"
          >
            <Sparkles size={16} />
            <span>{tr("开始使用")}</span>
            <ArrowRight size={15} />
          </HomeSectionLink>
          <button
            type="button"
            onClick={() =>
              document.getElementById("demo")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
                block: "start",
              })
            }
            className="button button-secondary hero-btn-secondary"
          >
            <Play size={14} fill="currentColor" />
            <span>{tr("看看效果")}</span>
          </button>
        </div>

        {/* Social Proof & Trust Badges */}
        <div className="hero-trust-bar">
          <div className="hero-avatar-stack" aria-hidden="true">
            <span className="hero-avatar"><Users size={14} /></span>
            <span className="hero-avatar"><Sparkles size={14} /></span>
            <span className="hero-avatar"><ShieldCheck size={14} /></span>
            <span className="hero-avatar"><Zap size={14} /></span>
          </div>
          <div className="hero-rating-block">
            <div className="hero-stars" aria-hidden="true">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} fill="currentColor" />
              ))}
            </div>
            <span className="hero-rating-text">4.9 / 5.0</span>
          </div>
          <div className="hero-proof-chips">
            <span className="proof-chip">
              <Check size={14} />
              {tr("公开浏览全部工具")}
            </span>
            <span className="proof-chip">
              <Check size={14} />
              {tr("新账户赠送 {0} 积分", [freeCredits])}
            </span>
            <span className="proof-chip">
              <Check size={14} />
              {tr("按成功生成计费")}
            </span>
          </div>
        </div>
      </section>

      {/* Interactive Live Studio Window */}
      <div className="container demo-container">
        <ProductDemo />
      </div>

      {/* Numerical Metrics Bar (SaaS Credibility Strip) */}
      <section className="metrics-strip container" aria-label={tr("主流创作场景")}>
        <div className="metric-item">
          <strong className="metric-val">100,000+</strong>
          <span className="metric-lbl">{tr("累计生成字数")}</span>
        </div>
        <div className="metric-divider" aria-hidden="true" />
        <div className="metric-item">
          <strong className="metric-val">&lt; 0.8s</strong>
          <span className="metric-lbl">{tr("平均首字响应")}</span>
        </div>
        <div className="metric-divider" aria-hidden="true" />
        <div className="metric-item">
          <strong className="metric-val">99.6%</strong>
          <span className="metric-lbl">{tr("创作者好评率")}</span>
        </div>
        <div className="metric-divider" aria-hidden="true" />
        <div className="metric-item">
          <strong className="metric-val">4 大</strong>
          <span className="metric-lbl">{tr("主流创作场景")}</span>
        </div>
      </section>

      {/* Cinematic AI Video Showreel */}
      <VideoShowreel />

      {/* Creative Scenarios Ribbon */}
      <section className="usecase-strip container" aria-label={tr("为每一种日常创作准备")}>
        <div className="usecase-header">
          <Sparkles size={14} className="text-accent" />
          <span>{tr("为每一种日常创作准备")}</span>
        </div>
        <div className="usecase-grid">
          <div className="usecase-card">
            <div className="usecase-icon-box icon-orange">
              <PenLine size={20} />
            </div>
            <div className="usecase-text">
              <strong>{tr("内容写作")}</strong>
              <span>自媒体推文 · 博客专栏 · 灵感扩展</span>
            </div>
          </div>
          <div className="usecase-card">
            <div className="usecase-icon-box icon-purple">
              <Megaphone size={20} />
            </div>
            <div className="usecase-text">
              <strong>{tr("产品营销")}</strong>
              <span>宣传标语 · 广告文案 · 落地页叙事</span>
            </div>
          </div>
          <div className="usecase-card">
            <div className="usecase-icon-box icon-blue">
              <Briefcase size={20} />
            </div>
            <div className="usecase-text">
              <strong>{tr("效率办公")}</strong>
              <span>会议纪要 · 商务邮件 · 关键要点提炼</span>
            </div>
          </div>
          <div className="usecase-card">
            <div className="usecase-icon-box icon-green">
              <Languages size={20} />
            </div>
            <div className="usecase-text">
              <strong>{tr("跨语言表达")}</strong>
              <span>地道中英互译 · 融入本地搜索关键词</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tool Catalog */}
      <ToolCatalog />

      {/* Feature Bento Grid */}
      <FeatureOverview />

      {/* Testimonials / Social Proof Section */}
      <section className="testimonials-section container" aria-label={tr("创作者之声")}>
        <div className="marketing-heading">
          <div className="feature-pill-badge">
            <Quote size={13} />
            <span>{tr("创作者之声")}</span>
          </div>
          <h2>{tr("听听创作者们怎么说")}</h2>
        </div>
        <div className="testimonials-grid">
          <article className="testimonial-card">
            <div className="testimonial-stars" aria-hidden="true">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} fill="currentColor" />
              ))}
            </div>
            <p className="testimonial-quote">
              “{tr("每天写推文和润色标题节省了至少 2 个小时，表达非常自然接地气！")}”
            </p>
            <div className="testimonial-author">
              <div className="author-avatar"><PenLine size={16} /></div>
              <div className="author-info">
                <strong>林辰</strong>
                <span>{tr("自媒体主理人")}</span>
              </div>
            </div>
          </article>

          <article className="testimonial-card featured-testimonial">
            <div className="testimonial-stars" aria-hidden="true">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} fill="currentColor" />
              ))}
            </div>
            <p className="testimonial-quote">
              “{tr("翻译非常地道，保留了海外用户习惯的关键词，比普通机翻好太多。")}”
            </p>
            <div className="testimonial-author">
              <div className="author-avatar"><Languages size={16} /></div>
              <div className="author-info">
                <strong>Alex Zhao</strong>
                <span>{tr("出海独立开发者")}</span>
              </div>
            </div>
          </article>

          <article className="testimonial-card">
            <div className="testimonial-stars" aria-hidden="true">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} fill="currentColor" />
              ))}
            </div>
            <p className="testimonial-quote">
              “{tr("团队日常写邮件和整理会议纪要的必备神器，按成功生成扣费很安心。")}”
            </p>
            <div className="testimonial-author">
              <div className="author-avatar"><Briefcase size={16} /></div>
              <div className="author-info">
                <strong>Sarah Wang</strong>
                <span>{tr("产品运营专家")}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Pricing Matrix */}
      <section className="marketing-pricing container" id="pricing">
        <div className="marketing-heading">
          <h2>{tr("按你的节奏，选择创作空间。")}</h2>
          <p>{tr("从免费积分开始，需要更多时再升级。")}</p>
        </div>
        <Pricing
          signedIn={signedIn}
          enabled={paymentsReady}
          paymentsPaused={paymentsPaused}
          paymentProviders={paymentProviders}
          plans={plans}
        />
      </section>

      {/* FAQ Accordion */}
      <FaqSection freeCredits={freeCredits} />

      {/* High-Converting Bottom Banner */}
      <section className="marketing-closing-wrapper container">
        <div className="marketing-closing-card">
          <div className="closing-glow" aria-hidden="true" />
          <h2>
            {tr("下一个好想法，")}
            <br />
            {tr("从这里开始。")}
          </h2>
          <p>{tr("选一个工具，把脑海中的想法写出来。")}</p>
          <div className="closing-actions">
            <HomeSectionLink
              section="tools"
              className="button button-primary hero-btn-primary"
            >
              <Sparkles size={16} />
              <span>{tr("探索 AI 工具")}</span>
              <ArrowRight size={15} />
            </HomeSectionLink>
          </div>
          <div className="closing-perks">
            <span>
              <ShieldCheck size={14} className="text-positive" />
              {tr("新账户赠送 {0} 积分", [freeCredits])}
            </span>
            <span>
              <Zap size={14} className="text-accent" />
              {tr("按成功生成计费")}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
