import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Menu } from "@base-ui/react/menu";
import {
  Clock,
  CreditCard,
  ReceiptText,
  Settings,
  Shield,
  Power,
} from "lucide-react";
import { useI18n } from "@/i18n/react";
import { authClient, clearClientSessionCache } from "@/modules/auth/client";
import { clearResourceCache } from "@/lib/use-resource";
import { toast } from "@/components/ui/toast";

export interface AccountMenuUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
}

export function UserAccountMenu({
  user,
  isAdmin = false,
}: {
  user: AccountMenuUser;
  isAdmin?: boolean;
}) {
  const { t: tr } = useI18n();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    user.name?.trim() || user.email?.split("@")[0] || tr("我的账户");
  const initial = (user.name?.trim() || user.email || "U")
    .charAt(0)
    .toUpperCase();

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      clearClientSessionCache();
      clearResourceCache();
      await authClient.signOut();
      toast.success(tr("已退出登录"));
      await navigate({ to: "/" });
      window.location.reload();
    } catch {
      toast.error(tr("操作失败，请重试。"));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className="header-account-trigger"
        aria-label={tr("我的账户")}
      >
        {user.image ? (
          <img src={user.image} alt="" className="account-avatar-img" />
        ) : (
          <div className="account-avatar-circle">{initial}</div>
        )}
        <span className="account-trigger-name">{displayName}</span>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          sideOffset={8}
          align="end"
          className="select-positioner"
        >
          <Menu.Popup
            className="account-menu-popup"
            aria-label={tr("账户菜单")}
          >
            <div className="account-menu-header">
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="account-avatar-img large"
                />
              ) : (
                <div className="account-avatar-circle large">{initial}</div>
              )}
              <div className="account-menu-user-info">
                <strong>{displayName}</strong>
                {user.email && <small title={user.email}>{user.email}</small>}
              </div>
            </div>

            <div className="account-menu-divider" />

            <Menu.Item
              closeOnClick
              className="account-menu-item"
              onClick={() => void navigate({ to: "/history" })}
            >
              <Clock size={15} />
              <span>{tr("生成历史")}</span>
            </Menu.Item>

            <Menu.Item
              closeOnClick
              className="account-menu-item"
              onClick={() => void navigate({ to: "/subscriptions" })}
            >
              <CreditCard size={15} />
              <span>{tr("会员与积分")}</span>
            </Menu.Item>

            <Menu.Item
              closeOnClick
              className="account-menu-item"
              onClick={() => void navigate({ to: "/billing" })}
            >
              <ReceiptText size={15} />
              <span>{tr("积分账单明细")}</span>
            </Menu.Item>

            <Menu.Item
              closeOnClick
              className="account-menu-item"
              onClick={() => void navigate({ to: "/settings" })}
            >
              <Settings size={15} />
              <span>{tr("账户设置")}</span>
            </Menu.Item>

            {(isAdmin || user.isAdmin) && (
              <Menu.Item
                closeOnClick
                className="account-menu-item is-admin"
                onClick={() => void navigate({ to: "/admin" })}
              >
                <Shield size={15} />
                <span>{tr("管理控制台")}</span>
              </Menu.Item>
            )}

            <div className="account-menu-divider" />

            <Menu.Item
              closeOnClick
              disabled={signingOut}
              className="account-menu-item is-logout"
              onClick={() => void handleSignOut()}
            >
              <Power size={15} />
              <span>{signingOut ? tr("正在退出…") : tr("退出登录")}</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
