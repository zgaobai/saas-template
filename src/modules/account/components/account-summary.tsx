import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { formatDateTime } from "@/lib/date";
import { Notice } from "@/components/ui/feedback";
import { legacyPlanNames } from "@/modules/billing/plans";
import type { AccountBilling } from "../types";
const planName = (id: string) => legacyPlanNames[id] || id;
export function AccountSummary({ data }: { data: AccountBilling }) {
  const { t: tr, locale } = useI18n();
  return (
    <>
      <div className="account-summary">
        <div>
          <span>{tr("可用积分")}</span>
          <strong>{data.balance}</strong>
          <Link to="/billing">{tr("查看积分流水")}</Link>
        </div>
        <div>
          <span>{tr("当前套餐")}</span>
          <strong className="account-plan-name">
            {tr(
              data.entitlement
                ? data.entitlement.plan_name ||
                    planName(data.entitlement.plan_id)
                : data.freePlanName,
            )}
          </strong>
          <small>
            {data.entitlement?.status === "REDEEMED"
              ? tr("兑换权益，不自动续费")
              : data.entitlement
                ? tr("已付套餐权益有效")
                : tr("使用账户积分，无有效期套餐")}
          </small>
        </div>
        <div>
          <span>{tr("权益到期时间")}</span>
          <strong className="account-plan-name">
            {data.entitlement
              ? formatDateTime(data.entitlement.paid_until, locale)
              : tr("不适用")}
          </strong>
          <Link to="/pricing">{tr("查看套餐")}</Link>
        </div>
      </div>
      {data.nextGrant && (
        <Notice>
          {tr("下期积分起算时间：{0} · {1} 积分（{2}，第 {3}/12 期）。", [
            formatDateTime(data.nextGrant.due_at, locale),
            data.nextGrant.credits,
            tr(data.nextGrant.plan_name),
            data.nextGrant.installment,
          ])}
          {tr(
            data.nextGrant.due_at <= Date.now()
              ? "已到发放时间，等待每日批次处理。"
              : "每日统一处理，通常在起算后 24 小时内到账，无需手动领取。",
          )}
        </Notice>
      )}
    </>
  );
}
