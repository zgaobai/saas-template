import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CreditCard, ListChecks, Coins } from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { useResource } from "@/lib/use-resource";
import { Button } from "@/components/ui/button";
import { Notice, Loading } from "@/components/ui/feedback";
import { AccountSummary } from "./account-summary";
import type { AccountBilling } from "../types";
export function AccountOverview({
  user,
}: {
  user: {
    name: string;
    email: string;
  };
}) {
  const { t: tr, locale } = useI18n();
  const { data, error, loading, reload } = useResource<AccountBilling>(
    "/api/app/billing/summary",
    true,
  );
  return (
    <div className="account-page">
      <PageHeading
        title={tr("账户概览")}
        description={tr("你的账户、可用积分和套餐权益。")}
        action={
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void reload()}
          >
            {tr("刷新")}
          </Button>
        }
      />
      <div className="account-identity">
        <div>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </div>
        <Link to="/settings" className="button button-secondary">
          {tr("编辑资料")}
        </Link>
      </div>
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && !error && <AccountSummary data={data} />
      )}
      <nav className="account-shortcuts" aria-label={tr("账户常用操作")}>
        <Link
          to="/subscriptions"
          search={{
            section: "subscriptions",
          }}
        >
          <CreditCard size={20} />
          <span>
            <strong>{tr("套餐与订单")}</strong>
            <small>{tr("管理续费、兑换权益与查看付款记录")}</small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/billing">
          <Coins size={20} />
          <span>
            <strong>{tr("积分流水")}</strong>
            <small>{tr("查看积分获得、使用和失败退回")}</small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/history">
          <ListChecks size={20} />
          <span>
            <strong>{tr("任务列表")}</strong>
            <small>{tr("查看生成状态、内容与结果")}</small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
      </nav>
    </div>
  );
}
