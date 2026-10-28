import { createFileRoute } from "@tanstack/react-router";
import { AdminFeedbacks } from "@/modules/admin/components/feedbacks";

export const Route = createFileRoute("/_app/admin/feedbacks")({
  component: AdminFeedbacks,
});
