import { useI18n } from "@/i18n/react";
import { LanguageSwitcher } from "@/i18n/react";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  CreditCard,
  LayoutDashboard,
  ListChecks,
  Coins,
  Gift,
  Package,
  Settings,
  Shield,
  Sparkles,
  Users,
  Bot,
  ClipboardList,
  Megaphone,
  Activity,
  MessageSquare,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Brand } from "./brand";
import { authClient, clearClientSessionCache } from "@/modules/auth/client";
import { clearResourceCache } from "@/lib/use-resource";
import { Button } from "@/components/ui/button";
import { UserAccountMenu } from "./user-account-menu";
export function AppShell({
  user,
}: {
  user: {
    name: string;
    email: string;
    isAdmin: boolean;
  };
}) {
  const { t: tr, locale } = useI18n();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const locationHref = useRouterState({
    select: (state) => state.location.href,
  });
  useEffect(() => {
    setMenuOpen(false);
  }, [locationHref]);
  const isAdminPage = useRouterState({
    select: (state) =>
      state.location.pathname === "/admin" ||
      state.location.pathname.startsWith("/admin/"),
  });
  return (
    <div className={`app-shell ${isAdminPage ? "" : "account-shell"}`}>
      <aside
        className="sidebar"
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <div className="sidebar-brand">
          <Brand />
          <Link to="/" search={{}} className="sidebar-return">
            {tr("返回网站")}
            <ArrowUpRight size={14} />
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="button button-secondary mobile-nav-toggle"
            aria-label={menuOpen ? tr("收起菜单") : tr("打开菜单")}
            aria-expanded={menuOpen}
            aria-controls="account-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {!isAdminPage && <p className="sidebar-label">{tr("我的账户")}</p>}
        <nav
          id="account-navigation"
          className={menuOpen ? "is-open" : ""}
          aria-label={isAdminPage ? tr("管理导航") : tr("账户导航")}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
          }}
        >
          {!isAdminPage && (
            <>
              <Link
                to="/history"
                activeProps={{
                  className: "active",
                }}
              >
                <Sparkles size={18} />
                {tr("生成历史")}
              </Link>
              <Link
                to="/subscriptions"
                search={{
                  section: "subscriptions",
                }}
                activeOptions={{
                  includeSearch: false,
                }}
                activeProps={{
                  className: "active",
                }}
              >
                <CreditCard size={18} />
                {tr("会员与积分")}
              </Link>
              <Link
                to="/settings"
                activeProps={{
                  className: "active",
                }}
              >
                <Settings size={18} />
                {tr("账户设置")}
              </Link>
            </>
          )}
          {isAdminPage && (
            <>
              <Link
                to="/admin/overview"
                search={{}}
                activeProps={{
                  className: "active",
                }}
              >
                <LayoutDashboard size={18} />
                {tr("数据总览")}
              </Link>
              <Link
                to="/admin/ai"
                activeProps={{
                  className: "active",
                }}
              >
                <Bot size={18} />
                {tr("AI 模型配置")}
              </Link>
              <Link
                to="/admin/users"
                activeProps={{
                  className: "active",
                }}
              >
                <Users size={18} />
                {tr("用户管理")}
              </Link>
              <Link
                to="/admin/tasks"
                search={{}}
                activeProps={{
                  className: "active",
                }}
              >
                <ListChecks size={18} />
                {tr("生成任务")}
              </Link>
              <Link
                to="/admin/billing"
                activeProps={{
                  className: "active",
                }}
              >
                <CreditCard size={18} />
                {tr("订单与订阅")}
              </Link>
              <Link
                to="/admin/ledger"
                search={{}}
                activeProps={{
                  className: "active",
                }}
              >
                <Coins size={18} />
                {tr("积分流水")}
              </Link>
              <Link
                to="/admin/plans"
                search={{}}
                activeProps={{
                  className: "active",
                }}
              >
                <Package size={18} />
                {tr("套餐配置")}
              </Link>
              <Link
                to="/admin/codes"
                search={{}}
                activeProps={{
                  className: "active",
                }}
              >
                <Gift size={18} />
                {tr("兑换码")}
              </Link>
              <Link
                to="/admin/audit"
                activeProps={{
                  className: "active",
                }}
              >
                <ClipboardList size={18} />
                {tr("操作记录")}
              </Link>
              <Link
                to="/admin/announcements"
                activeProps={{
                  className: "active",
                }}
              >
                <Megaphone size={18} />
                {tr("全站公告")}
              </Link>
              <Link
                to="/admin/feedbacks"
                activeProps={{
                  className: "active",
                }}
              >
                <MessageSquare size={18} />
                {tr("用户反馈")}
              </Link>
              <Link
                to="/admin/diagnostics"
                activeProps={{
                  className: "active",
                }}
              >
                <Activity size={18} />
                {tr("服务诊断")}
              </Link>
            </>
          )}
          {user.isAdmin && !isAdminPage && (
            <Link
              to="/admin"
              activeProps={{
                className: "active",
              }}
            >
              <Shield size={18} />
              {tr("管理后台")}
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="account">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              {user.isAdmin && (
                <span className="account-role">{tr("管理员")}</span>
              )}
              <span>{user.email}</span>
            </div>
            <Button
              variant="ghost"
              aria-label={tr("退出登录")}
              onClick={async () => {
                clearClientSessionCache();
                clearResourceCache();
                await authClient.signOut();
                await navigate({
                  to: "/",
                });
              }}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <span>{isAdminPage ? tr("管理控制台") : tr("账户中心")}</span>
          <div className="app-topbar-actions">
            <UserAccountMenu user={user} isAdmin={user.isAdmin} />
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
