import { useI18n } from "@/i18n/react";
import { publicPlans } from "@/modules/billing/functions";
import { PricingFaq } from "@/modules/billing/components/pricing-faq";
import { pageHead } from "@/modules/seo/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import { Pricing } from "@/modules/billing/components/pricing";
import { capabilities, sessionInfo } from "@/modules/auth/functions";
import { site } from "@/site";
export const Route = createFileRoute("/pricing")({
  head: ({ match }) =>
    pageHead(
      {
        title: `价格方案 · ${site.name}`,
        description:
          "了解免费积分、月度订阅和一次性积分包，按你的创作需要选择方案。",
        path: "/pricing",
      },
      match.context.publicSite,
    ),
  loader: async () => ({
    plans: await publicPlans(),
    caps: await capabilities(),
    user: await sessionInfo(),
  }),
  component: Page,
});
function Page() {
  const { t: tr, locale } = useI18n();
  const { caps, user, plans } = Route.useLoaderData();
  return (
    <PublicLayout className="container pricing-page">
      <div className="section-heading">
        <h1>{tr("按你的创作节奏，开始。")}</h1>
        <p>{tr("先免费体验，需要更多时再选择合适的方案。")}</p>
      </div>
      <Pricing signedIn={Boolean(user)} enabled={caps.payments} plans={plans} />
      <PricingFaq
        freeCredits={plans.find((p) => p.mode === "free")?.credits ?? 0}
      />
    </PublicLayout>
  );
}
