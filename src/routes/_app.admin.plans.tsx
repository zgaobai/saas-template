import { createFileRoute } from "@tanstack/react-router";
import { AdminPlans } from "@/modules/admin/components/plans";
export const Route = createFileRoute("/_app/admin/plans")({
  component: AdminPlans,
});
