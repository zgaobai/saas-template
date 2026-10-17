export type AccountBilling = {
  balance: number;
  nextGrant: {
    due_at: number;
    credits: number;
    installment: number;
    plan_name: string;
  } | null;
  freePlanName: string;
  entitlement: {
    plan_id: string;
    plan_name?: string;
    paid_until: number;
    status: string;
  } | null;
  orders: {
    id: string;
    plan_id: string;
    plan_name: string;
    amount: number;
    status: string;
    created_at: number;
    checkout_url: string | null;
  }[];
  subscriptions: {
    plan_name: string;
    id: string;
    plan_id: string;
    status: string;
    paid_until: number;
  }[];
  redemptions: {
    id: string;
    credits: number;
    grant_months: number;
    plan_id: string | null;
    plan_name: string | null;
    expires_at: number;
    created_at: number;
  }[];
};

export type BillingRecordPage = Pick<
  AccountBilling,
  "orders" | "subscriptions" | "redemptions"
> & { nextCursor: string | null };
