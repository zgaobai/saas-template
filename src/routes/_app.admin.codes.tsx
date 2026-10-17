import { createFileRoute } from "@tanstack/react-router";
import { AdminCodes } from "@/modules/admin/components/codes";
export const Route = createFileRoute("/_app/admin/codes")({
  component: AdminCodes,
});
