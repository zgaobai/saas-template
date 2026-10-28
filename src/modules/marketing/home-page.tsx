import { useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { FeatureOverview } from "./features";
import { FaqSection } from "./faq";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  PenLine,
  History,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ProductDemo } from "./product-demo";
import { ToolCatalog } from "@/modules/tools/components/tool-catalog";
import { Pricing } from "@/modules/billing/components/pricing";
import { tools } from "@/modules/tools/catalog";
import type { Plan } from "@/modules/billing/plans";
export function HomePage({
  signedIn,
  paymentsReady,
  plans,
  paymentProviders = [],
}: {
  signedIn: boolean;
  paymentsReady: boolean;
  plans: Plan[];
  paymentProviders?: ("pancake" | "stripe" | "creem" | "paypal")[];
}) {
  const { t: tr, locale } = useI18n();
  return (
    <>
      <section className="saas-hero container">
        <HomeSectionLink section="tools" className="hero-announcement">
          {tr("{0} 款 AI 工具，开启下一次创作", [tools.length])}
          <span>
            <ArrowRight size={13} />
          </span>
        </HomeSectionLink>
        <h1>
          {tr("少一点重复工作，")}
          <br />
          {tr("多一点创作可能。")}
        </h1>
        <p>
          {tr("写文案、润色、摘要、翻译。把日常文字工作交给 AI，")}
          <br className="desktop-break" />
          {tr("让你的想法，更快成为可以使用的内容。")}
        </p>
        <div className="saas-hero-actions">
          <HomeSectionLink section="tools" className="button button-primary">
            {tr("开始使用")}
            <ArrowUpRight size={17} />
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
            className="button button-secondary"
          >
            {tr("看看效果")}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-proof">
          <span>
            <Check size={15} />
            {tr("公开浏览全部工具")}
          </span>
          <span>
            <Check size={15} />
            {tr("新账户赠送 {0} 积分", [
              plans.find((p) => p.mode === "free")?.credits ?? 0,
            ])}
          </span>
          <span>
            <Check size={15} />
            {tr("按成功生成计费")}
          </span>
        </div>
      </section>
      <div className="container demo-container">
        <ProductDemo />
      </div>
      <section className="usecase-strip container" aria-label={tr("适用场景")}>
        <span>{tr("为每一种日常创作准备")}</span>
        <div>
          <span>
            <PenLine size={18} />
            {tr("内容写作")}
          </span>
          <span>
            <Sparkles size={18} />
            {tr("产品营销")}
          </span>
          <span>
            <History size={18} />
            {tr("效率办公")}
          </span>
          <span>
            <ShieldCheck size={18} />
            {tr("跨语言表达")}
          </span>
        </div>
      </section>
      <ToolCatalog />
      <FeatureOverview />
      <section className="marketing-pricing container" id="pricing">
        <div className="marketing-heading">
          <h2>{tr("按你的节奏，选择创作空间。")}</h2>
          <p>{tr("从免费积分开始，需要更多时再升级。")}</p>
        </div>
        <Pricing
          signedIn={signedIn}
          enabled={paymentsReady}
          paymentProviders={paymentProviders}
          plans={plans}
        />
      </section>
      <FaqSection
        freeCredits={plans.find((p) => p.mode === "free")?.credits ?? 0}
      />
      <section className="marketing-closing container">
        <h2>
          {tr("下一个好想法，")}
          <br />
          {tr("从这里开始。")}
        </h2>
        <p>{tr("选一个工具，把脑海中的想法写出来。")}</p>
        <HomeSectionLink section="tools" className="button button-primary">
          {tr("探索 AI 工具")}
          <ArrowRight size={17} />
        </HomeSectionLink>
      </section>
    </>
  );
}
