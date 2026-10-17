import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { HttpError } from "@/server/http";
import type { AdminPlan } from "../plans";
type Row = Omit<
  AdminPlan,
  "features" | "enabled" | "paymentBindings" | "annualPaymentBindings"
> & {
  features: string;
  payment_bindings: string;
  annual_payment_bindings: string;
  enabled: number;
};
function convert(row: Row): AdminPlan {
  const { payment_bindings, annual_payment_bindings, ...plan } = row;
  return {
    ...plan,
    paymentBindings: JSON.parse(payment_bindings),
    annualPaymentBindings: JSON.parse(annual_payment_bindings),
    features: JSON.parse(row.features),
    enabled: Boolean(row.enabled),
  };
}
export async function getPlans() {
  const rows = await bindings()
    .DB.prepare(
      "SELECT id,name,mode,billing_interval AS interval,payment_bindings,annual_price AS annualPrice,annual_payment_bindings,price,credits,description,features,enabled,revision FROM plan_configs WHERE billing_interval IS NULL OR billing_interval <> 'year' ORDER BY CASE id WHEN 'starter' THEN 0 WHEN 'creator' THEN 1 ELSE 2 END,mode,billing_interval,name,id LIMIT 100",
    )
    .all<Row>();
  return rows.results.map(convert);
}
export async function getPlan(id: string) {
  const row = await bindings()
    .DB.prepare(
      "SELECT id,name,mode,billing_interval AS interval,payment_bindings,annual_price AS annualPrice,annual_payment_bindings,price,credits,description,features,enabled,revision FROM plan_configs WHERE id=?",
    )
    .bind(id)
    .first<Row>();
  if (!row) throw new HttpError(404, "套餐不存在。");
  return convert(row);
}

export async function getPublicPlans() {
  return (await getPlans())
    .filter((p) => p.enabled)
    .map(
      ({
        paymentBindings: _private,
        annualPaymentBindings: _annualPrivate,
        ...plan
      }) => plan,
    );
}
