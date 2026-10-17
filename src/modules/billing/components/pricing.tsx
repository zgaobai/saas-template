import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { type Plan, supportsAnnual, annualSavings } from "../plans";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { PlanCard } from "./plan-card";
import { CreditPackCard } from "./credit-pack-card";
export function Pricing({
  signedIn,
  enabled,
  plans,
}: {
  signedIn: boolean;
  enabled: boolean;
  plans: Plan[];
}) {
  const { t: tr, locale } = useI18n();
  const [pending, setPending] = useState("");
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
  async function buy(plan: Plan) {
    setPending(plan.id);
    setError("");
    try {
      const period =
        plan.mode === "subscription" ? selectedInterval : undefined;
      const requestKey = `${plan.id}:${period ?? "payment"}`;
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
        }),
      });
      window.location.assign(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建订单失败");
    } finally {
      setPending("");
    }
  }
  const cardProps = {
    signedIn,
    enabled,
    pending,
    onBuy: buy,
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
    </>
  );
}
