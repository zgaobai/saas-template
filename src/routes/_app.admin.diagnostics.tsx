import { createFileRoute } from "@tanstack/react-router";
import { AdminDiagnostics } from "@/modules/admin/components/diagnostics";

export const Route = createFileRoute("/_app/admin/diagnostics")({
  component: AdminDiagnostics,
});
