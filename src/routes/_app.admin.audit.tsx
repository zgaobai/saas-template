import { createFileRoute } from "@tanstack/react-router";
import { AdminAudit } from "@/modules/admin/components/audit";
export const Route = createFileRoute("/_app/admin/audit")({
  component: AdminAudit,
});
