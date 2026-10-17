import { createFileRoute } from "@tanstack/react-router";
import { CreditLedger } from "@/modules/account/components/credit-ledger";
export const Route = createFileRoute("/_app/billing")({
  component: CreditLedger,
});
