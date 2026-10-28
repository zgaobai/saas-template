import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionInfo } from "@/modules/auth/functions";
import {
  getCachedClientSession,
  setCachedClientSession,
  type SessionUser,
} from "@/modules/auth/client";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    let user: SessionUser | null = getCachedClientSession();
    if (!user) {
      user = (await sessionInfo()) as SessionUser | null;
      setCachedClientSession(user);
    }
    if (!user)
      throw redirect({ to: "/", search: { auth: "login", next: location.pathname } });
    return { user };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: Layout,
});
function Layout() {
  const { user } = Route.useRouteContext();
  return <AppShell user={user} />;
}
