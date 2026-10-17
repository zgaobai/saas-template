import { createFileRoute } from "@tanstack/react-router";
import { AdminAiConfig } from "@/modules/admin/components/ai-config";

export const Route = createFileRoute("/_app/admin/ai")({
  component: AdminAiConfig,
});
