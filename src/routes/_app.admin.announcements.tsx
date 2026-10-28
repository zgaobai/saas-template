import { createFileRoute } from "@tanstack/react-router";
import { AdminAnnouncements } from "@/modules/admin/components/announcements";

export const Route = createFileRoute("/_app/admin/announcements")({
  component: AdminAnnouncements,
});
