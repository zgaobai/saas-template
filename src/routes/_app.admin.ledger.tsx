import { createFileRoute } from "@tanstack/react-router";
import { AdminLedger } from "@/modules/admin/components/ledger";
export const Route = createFileRoute("/_app/admin/ledger")({
  component: AdminLedger,
});
