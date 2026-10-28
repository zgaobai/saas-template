import { LanguageSwitcher, useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { AuthLink } from "@/modules/auth/components/auth-dialog";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, UserRound, X } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { authClient } from "@/modules/auth/client";
export function Header() {
  const { t: tr, locale } = useI18n();
  const { data } = authClient.useSession();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav
          id="primary-navigation"
          className={open ? "navigation-open" : ""}
          aria-label={tr("网站导航")}
          onClick={() => setOpen(false)}
        >
          <HomeSectionLink section="tools">{tr("AI 工具")}</HomeSectionLink>
          <HomeSectionLink section="features">{tr("功能介绍")}</HomeSectionLink>
          <Link to="/pricing">{tr("价格方案")}</Link>
          <Link to="/blog">{tr("博客")}</Link>
          <HomeSectionLink section="faq">{tr("常见问题")}</HomeSectionLink>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <LanguageSwitcher />
          {data?.user ? (
            <Link
              to="/subscriptions"
              className="button button-secondary button-small header-account"
              aria-label={tr("我的账户")}
            >
              <UserRound size={17} className="header-account-icon" />
              <span>{tr("我的账户")}</span>
              <ArrowUpRight size={14} className="header-account-arrow" />
            </Link>
          ) : (
            <AuthLink className="button button-primary button-small header-login">
              {tr("登录")}
            </AuthLink>
          )}
          <button
            className="mobile-menu"
            aria-label={open ? tr("收起导航") : tr("展开导航")}
            aria-controls="primary-navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}
