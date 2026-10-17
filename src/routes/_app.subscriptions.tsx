import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BillingInfo } from "@/modules/account/components/billing-info";
export const Route = createFileRoute("/_app/subscriptions")({
  validateSearch: z.object({
    section: z
      .enum(["subscriptions", "orders", "redemptions"])
      .catch("subscriptions"),
  }),
  component: Page,
});
function Page() {
  const { section } = Route.useSearch();
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
