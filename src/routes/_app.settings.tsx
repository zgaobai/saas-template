import { createFileRoute } from "@tanstack/react-router";
import { accountSecurity } from "@/modules/auth/functions";
import { AccountSettings } from "@/modules/account/components/account-settings";
export const Route = createFileRoute("/_app/settings")({
  loader: () => accountSecurity(),
  component: Page,
});
function Page() {
  const { user } = Route.useRouteContext();
  const security = Route.useLoaderData();
  return <AccountSettings user={user} security={security} />;
}
