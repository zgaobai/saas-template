import { publicPlans } from "@/modules/billing/functions";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import { HomePage } from "@/modules/marketing/home-page";
import { capabilities, sessionInfo } from "@/modules/auth/functions";
import { pageHead } from "@/modules/seo/metadata";
import { site } from "@/site";
export const Route = createFileRoute("/")({
  head: ({ match }) =>
    pageHead(
      {
        title: `${site.name} · 让日常创作更轻松`,
        description: site.description,
        path: "/",
      },
      match.context.publicSite,
    ),
  loader: async () => {
    const [caps, user, plans] = await Promise.all([
      capabilities(),
      sessionInfo(),
      publicPlans(),
    ]);
    return {
      signedIn: !!user,
      paymentsReady: caps.payments,
      paymentsPaused: Boolean(caps.paymentsPaused),
      paymentProviders: caps.paymentProviders ?? [],
      plans,
    };
  },
  component: Home,
});
function Home() {
  const data = Route.useLoaderData();
  return (
    <PublicLayout className="marketing-home">
      <HomePage {...data} />
    </PublicLayout>
  );
}
