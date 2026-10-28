import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { type Plan, supportsAnnual, annualSavings } from "../plans";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { PlanCard } from "./plan-card";
import { CreditPackCard } from "./credit-pack-card";

function PayPalIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .76-.642h6.885c3.224 0 5.617 1.348 6.002 4.673.328 2.825-1.396 4.966-4.093 5.753-.296.086-.532.32-.596.621l-.986 4.63-.374 1.761a.641.641 0 0 1-.632.544H7.076z" />
      <path
        d="M8.882 17.587l.987-4.63c.064-.301.3-.535.596-.621 2.697-.787 4.421-2.928 4.093-5.753-.385-3.325-2.778-4.673-6.002-4.673H1.67a.77.77 0 0 0-.76.642L.004 8.78h3.948a.77.77 0 0 1 .76.643l1.874 8.805a.641.641 0 0 0 .633.543h1.663z"
        opacity="0.3"
      />
    </svg>
  );
}

export function Pricing({
  signedIn,
  enabled,
  plans,
  paymentProviders = [],
}: {
  signedIn: boolean;
  enabled: boolean;
  plans: Plan[];
  paymentProviders?: ("pancake" | "stripe" | "creem" | "paypal")[];
}) {
  const { t: tr, locale } = useI18n();
  const [pending, setPending] = useState("");
  const [submittingProvider, setSubmittingProvider] = useState<string>("");
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] =
    useState<Plan | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const annualPlans = plans.filter(supportsAnnual);
  const selectedInterval = annualPlans.length ? interval : "month";
  const subscriptions = plans.filter(
    (p) =>
      p.mode === "free" ||
      (p.mode === "subscription" &&
        (selectedInterval === "year"
          ? supportsAnnual(p)
          : p.interval !== "year")),
  );
  const packs = plans.filter((p) => p.mode === "payment");
  const discounts = annualPlans.map((p) => annualSavings(p)?.percent ?? 0);
  const maxSaving = Math.max(0, ...discounts);
  const sameSaving = discounts.every((n) => n === maxSaving);
  const [error, setError] = useState("");
  const [requests] = useState<Record<string, string>>({});

  function getViableProviders(targetPlan: Plan) {
    if (targetPlan.mode === "free") return [];
    const configured =
      paymentProviders.length > 0
        ? paymentProviders
        : enabled
          ? (["pancake"] as ("pancake" | "stripe" | "creem" | "paypal")[])
          : [];
    const supported =
      selectedInterval === "year"
        ? targetPlan.annualSupportedProviders ??
          targetPlan.supportedProviders ??
          []
        : targetPlan.supportedProviders ?? [];
    return configured.filter((prov) => supported.includes(prov));
  }

  function handleBuyClick(plan: Plan) {
    const viable = getViableProviders(plan);
    if (viable.length > 1) {
      setSelectedPlanForCheckout(plan);
    } else {
      executeCheckout(plan, viable[0]);
    }
  }

  async function executeCheckout(
    plan: Plan,
    provider?: "pancake" | "stripe" | "creem" | "paypal",
  ) {
    setPending(plan.id);
    if (provider) setSubmittingProvider(provider);
    setError("");
    try {
      const period =
        plan.mode === "subscription" ? selectedInterval : undefined;
      const requestKey = `${plan.id}:${period ?? "payment"}:${provider || "default"}`;
      requests[requestKey] ??= crypto.randomUUID();
      const r = await api<{
        url: string;
      }>("/api/app/checkout", {
        method: "POST",
        body: JSON.stringify({
          planId: plan.id,
          requestId: requests[requestKey],
          planRevision: plan.revision,
          ...(period
            ? {
                interval: period,
              }
            : {}),
          ...(provider ? { provider } : {}),
        }),
      });
      window.location.assign(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建订单失败");
      setSelectedPlanForCheckout(null);
    } finally {
      setPending("");
      setSubmittingProvider("");
    }
  }

  const cardProps = {
    signedIn,
    enabled,
    pending,
    onBuy: handleBuyClick,
  };
  return (
    <>
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {annualPlans.length > 0 && (
        <div
          className="billing-switch"
          role="group"
          aria-label={tr("订阅计费方式")}
        >
          <Button
            variant="ghost"
            aria-pressed={selectedInterval === "month"}
            disabled={!!pending}
            onClick={() => setInterval("month")}
          >
            {tr("按月付费")}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={selectedInterval === "year"}
            disabled={!!pending}
            onClick={() => setInterval("year")}
          >
            {tr("按年付费")}
            {maxSaving > 0 && (
              <span className="billing-discount">
                {sameSaving ? tr("约省") : tr("最高约省")} {maxSaving}%
              </span>
            )}
          </Button>
        </div>
      )}
      {subscriptions.length > 0 && (
        <div className="pricing-grid">
          {subscriptions.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              yearly={
                plan.mode === "subscription" && selectedInterval === "year"
              }
              {...cardProps}
            />
          ))}
        </div>
      )}
      {packs.length > 0 && (
        <section className="pricing-packs" aria-label={tr("积分包")}>
          <div className="pricing-packs-heading">
            <h2>{tr("积分包")}</h2>
            <p>{tr("按需补充积分，一次购买，不自动续费。")}</p>
          </div>
          <div className="credit-packs-grid">
            {packs.map((plan) => (
              <CreditPackCard key={plan.id} plan={plan} {...cardProps} />
            ))}
          </div>
        </section>
      )}
      <p className="pricing-note">
        {tr(
          "金额以美元结算。每次成功生成消耗 1 积分，失败自动退回。月付每次到账发放当月积分；年付到账后按月发放，共 12 次。",
        )}
      </p>

      {selectedPlanForCheckout && (
        <Modal
          open={Boolean(selectedPlanForCheckout)}
          onClose={() => {
            if (!pending) setSelectedPlanForCheckout(null);
          }}
          title="选择支付方式"
          description="请选择你偏好的支付渠道完成结账。"
          busy={Boolean(pending)}
        >
          <div className="checkout-channels-list">
            {getViableProviders(selectedPlanForCheckout).map((prov) => {
              const isPayPal = prov === "paypal";
              const isSelected = submittingProvider === prov;

              return (
                <button
                  key={prov}
                  type="button"
                  className={`checkout-channel-btn ${isSelected ? "selected" : ""}`}
                  disabled={Boolean(pending)}
                  onClick={() =>
                    executeCheckout(selectedPlanForCheckout, prov)
                  }
                >
                  <div className="checkout-channel-info">
                    <div className="checkout-channel-icon">
                      {isPayPal ? (
                        <PayPalIcon size={22} />
                      ) : (
                        <CreditCard size={22} />
                      )}
                    </div>
                    <div className="checkout-channel-texts">
                      <h4>
                        <span>
                          {isPayPal
                            ? tr("PayPal 快捷支付")
                            : tr("信用卡 / 借记卡")}
                        </span>
                        <span className="checkout-channel-badge">
                          {isPayPal ? tr("电子钱包") : tr("信用卡")}
                        </span>
                      </h4>
                      <p>
                        {isPayPal
                          ? tr("使用 PayPal 余额或关联卡快捷结账")
                          : tr("支持全球主流信用卡与借记卡安全支付")}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="checkout-channel-loading">
                      {tr("正在跳转…")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
