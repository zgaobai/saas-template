import { useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { Link } from "@tanstack/react-router";
import { Brand } from "./brand";
import { GeoAskAiBar } from "./geo-ask-ai-bar";
import { site } from "@/site";

export function Footer() {
  const { t: tr } = useI18n();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand-col">
            <Brand />
            <p className="footer-tagline">
              {tr("少一点重复工作，多一点创作可能。")}
            </p>
            <div className="footer-status-pill">
              <span className="status-dot-pulse" aria-hidden="true" />
              <span>{tr("所有系统运行正常")}</span>
            </div>
          </div>

          <div className="footer-links-grid">
            <nav className="footer-col" aria-label={tr("产品链接")}>
              <strong className="footer-col-title">{tr("产品")}</strong>
              <HomeSectionLink section="tools">{tr("AI 工具")}</HomeSectionLink>
              <Link to="/pricing">{tr("价格方案")}</Link>
            </nav>

            <nav className="footer-col" aria-label={tr("帮助链接")}>
              <strong className="footer-col-title">{tr("资源")}</strong>
              <Link to="/blog">{tr("博客")}</Link>
              <HomeSectionLink section="faq">{tr("常见问题")}</HomeSectionLink>
              <Link to="/feedback">{tr("反馈建议")}</Link>
              <a
                href="https://github.com/zgaobai/saas-template"
                target="_blank"
                rel="noreferrer"
              >
                {tr("GitHub 仓库")}
              </a>
            </nav>

            <nav className="footer-col" aria-label={tr("法律信息")}>
              <strong className="footer-col-title">{tr("法律信息")}</strong>
              <Link to="/privacy">{tr("隐私说明")}</Link>
              <Link to="/terms">{tr("使用条款")}</Link>
            </nav>
          </div>
        </div>

        <GeoAskAiBar />

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {tr(site.name)} AI. {tr("保留所有权利。")}
          </span>
          <span className="footer-bottom-badge">Next-Gen SaaS</span>
        </div>
      </div>
    </footer>
  );
}
