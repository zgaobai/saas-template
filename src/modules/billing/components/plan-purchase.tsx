import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { AuthLink } from "@/modules/auth/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { type Plan } from "../plans";
export type PlanPurchaseProps = {
  plan: Plan;
  signedIn: boolean;
  enabled: boolean;
  paymentsPaused?: boolean;
  pending: string;
  onBuy: (plan: Plan) => void;
};
export function PlanPurchase({
  plan,
  signedIn,
  enabled,
  paymentsPaused = false,
  pending,
  onBuy,
}: PlanPurchaseProps) {
  const { t: tr } = useI18n();
  return plan.mode === "free" ? (
    signedIn ? (
      <Link to="/subscriptions" className="button button-secondary">
        {tr("我的账户")}
      </Link>
    ) : (
      <AuthLink mode="register" className="button button-secondary">
        {tr("免费开始")}
      </AuthLink>
    )
  ) : !signedIn ? (
    <AuthLink className="button button-primary">
      {tr("登录后购买")}
    </AuthLink>
  ) : (
    <Button
      disabled={!enabled || paymentsPaused || Boolean(pending)}
      onClick={() => onBuy(plan)}
    >
      {pending === plan.id
        ? tr("正在创建订单…")
        : paymentsPaused
          ? tr("支付维护中")
          : enabled
            ? tr("前往付款")
            : tr("支付暂未开放")}
    </Button>
  );
}
