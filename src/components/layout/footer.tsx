import { useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { Link } from "@tanstack/react-router";
import { Brand } from "./brand";
import { GeoAskAiBar } from "./geo-ask-ai-bar";
import { site } from "@/site";

export function Footer() {
  const { t: tr, locale } = useI18n();
  return (
    <footer className="container footer">
      <div className="footer-top">
        <div>
          <Brand />
          <p>{tr("少一点重复工作，多一点创作可能。")}</p>
        </div>
        <nav aria-label={tr("产品链接")}>
          <strong>{tr("产品")}</strong>
          <HomeSectionLink section="tools">{tr("AI 工具")}</HomeSectionLink>
          <Link to="/pricing">{tr("价格方案")}</Link>
        </nav>
        <nav aria-label={tr("帮助链接")}>
          <strong>{tr("资源")}</strong>
          <Link to="/blog">{tr("博客")}</Link>
          <HomeSectionLink section="faq">{tr("常见问题")}</HomeSectionLink>
          <a
            href="https://github.com/zgaobai/saas-template"
            target="_blank"
            rel="noreferrer"
          >
            {tr("GitHub 仓库")}
          </a>
        </nav>
        <nav aria-label={tr("法律信息")}>
          <strong>{tr("法律信息")}</strong>
          <Link to="/privacy">{tr("隐私说明")}</Link>
          <Link to="/terms">{tr("使用条款")}</Link>
        </nav>
      </div>
      <GeoAskAiBar />
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {tr(site.name)} AI. {tr("保留所有权利。")}
        </span>
      </div>
    </footer>
  );
}
