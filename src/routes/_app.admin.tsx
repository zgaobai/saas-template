import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_app/admin")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q:
      typeof search.q === "string" && search.q.length <= 256
        ? search.q
        : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/subscriptions" });
  },
  component: Outlet,
});
