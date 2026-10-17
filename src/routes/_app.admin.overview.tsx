import { createFileRoute } from "@tanstack/react-router";
import { AdminOverview } from "@/modules/admin/components/overview";
export const Route = createFileRoute("/_app/admin/overview")({
  component: AdminOverview,
});
