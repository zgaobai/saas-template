import { createFileRoute } from "@tanstack/react-router";
import { AdminUsers } from "@/modules/admin/components/users";
export const Route = createFileRoute("/_app/admin/users")({
  component: AdminUsers,
});
