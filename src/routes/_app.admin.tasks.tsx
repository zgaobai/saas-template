import { createFileRoute } from "@tanstack/react-router";
import { AdminTasks } from "@/modules/admin/components/tasks";
export const Route = createFileRoute("/_app/admin/tasks")({
  component: AdminTasks,
});
