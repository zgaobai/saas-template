import { useI18n } from "@/i18n/react";
import { formatPrice } from "../plans";
import { PlanPurchase, type PlanPurchaseProps } from "./plan-purchase";
export function CreditPackCard(props: PlanPurchaseProps) {
  const { t: tr, locale } = useI18n();
  const { plan } = props;
  return (
    <article className="credit-pack-card">
      <div className="credit-pack-info">
        <h3>{tr(plan.name)}</h3>
        <p>
          <strong>{plan.credits.toLocaleString("zh-CN")}</strong>
          {tr("积分")}
        </p>
      </div>
      <div className="credit-pack-price">
        {formatPrice(plan.price, locale)}
        <span>{tr("一次性")}</span>
      </div>
      <PlanPurchase {...props} />
    </article>
  );
}
