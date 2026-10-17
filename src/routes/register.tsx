import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeReturnTo } from "@/modules/tools/catalog";
export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: safeReturnTo(search.next),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/",
      search: { auth: "register", next: search.next },
    });
  },
});
