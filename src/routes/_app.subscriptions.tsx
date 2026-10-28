import { createFileRoute } from "@tanstack/react-router";
import { BillingInfo } from "@/modules/account/components/billing-info";
import type { BillingSection } from "@/modules/account/components/billing-records";

export const Route = createFileRoute("/_app/subscriptions")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { section?: BillingSection } => ({
    section: ["subscriptions", "orders", "redemptions"].includes(
      String(search.section),
    )
      ? (search.section as BillingSection)
      : undefined,
  }),
  component: Page,
});
function Page() {
  const { section = "subscriptions" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BillingInfo
      section={section}
      onSection={(section) =>
        void navigate({ search: { section }, replace: true })
      }
    />
  );
}
