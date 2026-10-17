import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionInfo } from "@/modules/auth/functions";
import { AppShell } from "@/components/layout/app-shell";
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const user = await sessionInfo();
    if (!user)
      throw redirect({ to: "/login", search: { next: location.pathname } });
    return { user };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: Layout,
});
function Layout() {
  const { user } = Route.useRouteContext();
  return <AppShell user={user} />;
}
