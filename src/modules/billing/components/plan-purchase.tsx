import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { AuthLink } from "@/modules/auth/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { type Plan } from "../plans";
export type PlanPurchaseProps = {
  plan: Plan;
  signedIn: boolean;
  enabled: boolean;
  pending: string;
  onBuy: (plan: Plan) => void;
};
export function PlanPurchase({
  plan,
  signedIn,
  enabled,
  pending,
  onBuy,
}: PlanPurchaseProps) {
  const { t: tr, locale } = useI18n();
  return plan.mode === "free" ? (
    signedIn ? (
      <Link to="/account" className="button button-secondary">
        {tr("我的账户")}
        <ArrowUpRight size={16} />
      </Link>
    ) : (
      <AuthLink mode="register" className="button button-secondary">
        {tr("免费开始")}
        <ArrowUpRight size={16} />
      </AuthLink>
    )
  ) : !signedIn ? (
    <AuthLink className="button button-primary">
      {tr("登录后购买")}
      <ArrowUpRight size={16} />
    </AuthLink>
  ) : (
    <Button disabled={!enabled || Boolean(pending)} onClick={() => onBuy(plan)}>
      {pending === plan.id
        ? tr("正在创建订单…")
        : enabled
          ? tr("前往付款")
          : tr("支付暂未开放")}
    </Button>
  );
}
