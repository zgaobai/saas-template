import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeReturnTo } from "@/modules/tools/catalog";
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: safeReturnTo(search.next),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search: { auth: "login", next: search.next } });
  },
});
