export function cents(value: unknown): number {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Invalid amount");
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new Error("Amount overflow");
  return amount;
}
export function checkoutUrl(action: unknown): string {
  if (typeof action !== "string") throw new Error("Missing checkout URL");
  let value = action;
  if (action.trim().startsWith("{")) {
    const parsed = JSON.parse(action);
    value = parsed.webUrl;
  }
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Invalid checkout URL");
  return url.toString();
}
export function assertPayment(
  expected: { amount: number; currency: string },
  actual: { amount: unknown; currency: unknown },
) {
  if (
    cents(actual.amount) !== expected.amount ||
    actual.currency !== expected.currency
  )
    throw new Error("Payment amount/currency mismatch");
}
