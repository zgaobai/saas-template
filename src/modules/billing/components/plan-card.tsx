import { useI18n } from "@/i18n/react";
import { Check, Sparkles } from "lucide-react";
import { formatPrice, annualSavings } from "../plans";
import { PlanPurchase, type PlanPurchaseProps } from "./plan-purchase";

export function PlanCard({
  yearly = false,
  ...props
}: PlanPurchaseProps & {
  yearly?: boolean;
}) {
  const { t: tr, locale } = useI18n();
  const { plan } = props;
  const annual =
    plan.interval === "year" ? plan.price : (plan.annualPrice ?? 0);
  const saving = yearly ? annualSavings(plan) : null;
  const isFeatured = plan.id === "creator";

  return (
    <article className={`price-plan ${isFeatured ? "featured" : ""}`}>
      {isFeatured && (
        <div className="plan-featured-ribbon">
          <Sparkles size={13} />
          <span>{tr("最受欢迎")}</span>
        </div>
      )}

      <header className="plan-heading">
        <h2>{tr(plan.name)}</h2>
        <p>{tr(plan.description)}</p>
      </header>

      <div className="plan-price-block">
        <div className="price">
          {formatPrice(yearly ? Math.round(annual / 12) : plan.price, locale)}
          <span className="price-interval">
            {plan.mode === "subscription" ? tr("/ 月") : tr("/ 免费")}
          </span>
        </div>
        {yearly ? (
          <p className="plan-billing-detail">
            {tr("按年支付")}
            {formatPrice(annual, locale)}
          </p>
        ) : (
          <p className="plan-billing-detail">
            {plan.mode === "free"
              ? tr("免费体验，无需付款")
              : tr("按月订阅，可取消续费")}
          </p>
        )}
        {saving && (
          <p className="annual-saving">
            <s
              className="price-original"
              aria-label={tr("原月付价格 {0}", [
                formatPrice(plan.price, locale),
              ])}
            >
              {formatPrice(plan.price, locale)}
              {tr("/ 月")}
            </s>
            <span className="annual-saving-pill">
              {tr("每年省")}
              {formatPrice(saving.amount, locale)}
            </span>
          </p>
        )}
      </div>

      <ul className="plan-features-list">
        <li className="feature-highlight">
          <Check size={16} className="text-positive" aria-hidden="true" />
          <span>
            {plan.mode === "subscription"
              ? tr("每月发放")
              : tr("一次性赠送")}{" "}
            <strong>{plan.credits}</strong> {tr("积分")}
          </span>
        </li>
        {plan.features.map((f) => (
          <li key={f}>
            <Check size={16} className="text-positive" aria-hidden="true" />
            <span>{tr(f)}</span>
          </li>
        ))}
      </ul>

      <div className="plan-action-wrapper">
        <PlanPurchase {...props} />
      </div>
    </article>
  );
}
