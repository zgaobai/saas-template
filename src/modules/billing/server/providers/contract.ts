import "@tanstack/react-start/server-only";
export type PaymentProviderId = "pancake" | "stripe" | "creem" | "paypal";
export interface CheckoutInput {
  orderId: string;
  planId: string;
  interval?: "month" | "year" | null;
  productRef?: string | null;
  amount: number;
  credits: number;
  userId: string;
  email: string;
  mode: "payment" | "subscription";
  name: string;
}
export interface CheckoutResult {
  subscriptionId?: string;
  providerId: string;
  url: string;
}
export interface PaymentProvider {
  id: PaymentProviderId;
  validateCheckout?(input: CheckoutInput): Promise<void>;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  cancelSubscription(id: string): Promise<void>;
}

// All values below come from authenticated provider API read-back, never redirect params.
export interface VerifiedPayment {
  orderId: string;
  userId: string;
  paymentId: string;
  amount: number;
  currency: string;
  subscriptionId?: string;
  coveredUntil?: number;
  coveredFrom?: number;
}
export interface VerifiedSubscription {
  orderId: string;
  userId: string;
  subscriptionId: string;
  status:
    | "ACTIVE"
    | "CANCELING"
    | "AUTHORIZATION_REQUIRED"
    | "IN_PROGRESS"
    | "CANCELED"
    | "EXPIRED"
    | "PAST_DUE";
  updatedAt: number;
}
export interface VerifiedRefund {
  cumulative?: boolean;
  refundId: string;
  paymentId: string;
  amount: number;
  currency: string;
}
export interface Reconciliation {
  payments?: VerifiedPayment[];
  subscriptions?: VerifiedSubscription[];
  refunds?: VerifiedRefund[];
  expiredOrderIds?: string[];
}
export interface CheckoutRecoveryInput {
  providerId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  mode: "payment" | "subscription";
}
export interface CheckoutRecovery {
  reconciliation: Reconciliation;
  // null clears a closed checkout; undefined preserves a URL not returned by this API.
  url?: string | null;
}
export interface IntegratedPaymentProvider extends PaymentProvider {
  syncCheckout(input: CheckoutRecoveryInput): Promise<CheckoutRecovery>;
  handleWebhook(request: Request): Promise<Reconciliation>;
  syncSubscription(id: string): Promise<Reconciliation>;
}
