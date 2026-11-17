import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import {
  PenLine,
  Clock,
  Wallet,
  Languages,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Globe2,
} from "lucide-react";

export function FeatureOverview({
  standalone = false,
}: {
  standalone?: boolean;
}) {
  const { t: tr } = useI18n();
  const Heading = standalone ? "h1" : "h2";

  return (
    <section className="marketing-features container" id="features">
      <div className="marketing-heading">
        <div className="feature-pill-badge">
          <Sparkles size={13} />
          <span>{tr("智能创作引擎")}</span>
        </div>
        <Heading>{tr("从灵感到成稿，每一步都简单。")}</Heading>
        <p>{tr("把时间留给想法，其余交给顺手的工具。")}</p>
      </div>

      {/* Modern Bento Grid Layout */}
      <div className="bento-grid">
        {/* Bento Card 1: Wide Hero (2 cols) */}
        <article className="bento-card bento-wide bento-highlight">
          <div className="bento-glow" aria-hidden="true" />
          <div className="bento-card-content">
            <div className="bento-icon-wrapper icon-orange">
              <PenLine size={22} />
            </div>
            <h3>{tr("从你的内容开始")}</h3>
            <p>
              {tr(
                "粘贴原文或描述需求，选择合适的语气。没有复杂指令，也能清楚表达你的想法。",
              )}
            </p>
            <Link
              to="/tools/$toolId"
              params={{
                toolId: "copywriting",
              }}
              className="bento-link"
            >
              <span>{tr("试试文案生成")}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Simulation Inside Card */}
          <div className="bento-mock bento-mock-prompt" aria-hidden="true">
            <div className="bento-mock-header">
              <span className="mock-dot" />
              <span className="mock-title">Smart Prompt · 语气增强</span>
            </div>
            <div className="bento-mock-body">
              <div className="mock-chip-row">
                <span className="mock-chip active">✦ 自然清晰</span>
                <span className="mock-chip">专业简洁</span>
                <span className="mock-chip">轻松有趣</span>
              </div>
              <div className="mock-text-preview">
                “为周末独立咖啡店写一段温暖介绍，留给时间放慢脚步……”
              </div>
            </div>
          </div>
        </article>

        {/* Bento Card 2: History (1 col) */}
        <article className="bento-card bento-compact">
          <div className="bento-card-content">
            <div className="bento-icon-wrapper icon-blue">
              <Clock size={22} />
            </div>
            <h3>{tr("每次创作，都能找回来")}</h3>
            <p>
              {tr(
                "登录后生成结果自动保存。随时回顾、复制，继续完善，不必从头开始。",
              )}
            </p>
            <Link to="/history" className="bento-link">
              <span>{tr("查看创作记录")}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Stack Mock */}
          <div className="bento-mock bento-mock-history" aria-hidden="true">
            <div className="mock-history-item item-top">
              <CheckCircle2 size={13} className="text-positive" />
              <span className="mock-history-title">咖啡馆社媒文案生成</span>
              <span className="mock-history-time">10 分钟前</span>
            </div>
            <div className="mock-history-item item-bottom">
              <CheckCircle2 size={13} className="text-positive" />
              <span className="mock-history-title">英文商务询盘邮件润色</span>
              <span className="mock-history-time">昨天</span>
            </div>
          </div>
        </article>

        {/* Bento Card 3: Transparent Ledger (1 col) */}
        <article className="bento-card bento-compact">
          <div className="bento-card-content">
            <div className="bento-icon-wrapper icon-green">
              <Wallet size={22} />
            </div>
            <h3>{tr("积分清楚，使用有数")}</h3>
            <p>
              {tr(
                "每次成功生成消耗 1 积分，失败自动退回。余额和每一笔变动，都能在账单里查看。",
              )}
            </p>
            <Link to="/pricing" className="bento-link">
              <span>{tr("了解积分方案")}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Credit Meter Mock */}
          <div className="bento-mock bento-mock-credits" aria-hidden="true">
            <div className="mock-credit-badge">
              <ShieldCheck size={16} className="text-positive" />
              <div>
                <strong className="mock-credit-num">1 积分 / 次</strong>
                <span className="mock-credit-sub">失败实时退回 · 0 隐性扣费</span>
              </div>
            </div>
          </div>
        </article>

        {/* Bento Card 4: Global Localization (2 cols) */}
        <article className="bento-card bento-wide">
          <div className="bento-glow" aria-hidden="true" />
          <div className="bento-card-content">
            <div className="bento-icon-wrapper icon-purple">
              <Languages size={22} />
            </div>
            <h3>{tr("地道本地化与跨语言表达")}</h3>
            <p>
              {tr(
                "融入目标受众本地搜索习惯与自然地道表达，拒绝生硬直译，助力内容轻松出海。",
              )}
            </p>
            <Link
              to="/tools/$toolId"
              params={{
                toolId: "translate",
              }}
              className="bento-link"
            >
              <span>{tr("体验中英翻译")}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Bilingual Mock */}
          <div className="bento-mock bento-mock-translate" aria-hidden="true">
            <div className="mock-lang-row">
              <div className="mock-lang-card">
                <span className="mock-lang-tag">中文原文</span>
                <p>感谢你试用我们的产品。如果遇到任何问题，欢迎随时联系我们。</p>
              </div>
              <div className="mock-lang-divider">
                <Globe2 size={16} />
              </div>
              <div className="mock-lang-card highlight">
                <span className="mock-lang-tag tag-accent">Native Idiomatic</span>
                <p>
                  Thank you for trying our product. If you run into any issues,
                  please feel free to let us know.
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
