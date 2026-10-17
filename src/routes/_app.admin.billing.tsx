import { createFileRoute } from "@tanstack/react-router";
import { AdminBilling } from "@/modules/admin/components/billing";
export const Route = createFileRoute("/_app/admin/billing")({
  component: AdminBilling,
});
