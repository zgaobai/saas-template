import { createFileRoute } from "@tanstack/react-router";
import { AccountOverview } from "@/modules/account/components/account-overview";
export const Route = createFileRoute("/_app/account")({ component: Page });
function Page() {
  const { user } = Route.useRouteContext();
  return <AccountOverview user={user} />;
}
