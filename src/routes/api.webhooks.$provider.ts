import { createFileRoute } from "@tanstack/react-router";
import { integratedProvider } from "@/modules/billing/server/providers/registry";
import { applyReconciliation } from "@/modules/billing/server/reconciliation";
import { endpoint } from "@/server/http";
export const Route = createFileRoute("/api/webhooks/$provider")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        endpoint(async () => {
          const p = integratedProvider(params.provider);
          const result = await p.handleWebhook(request);
          await applyReconciliation(p.id, result);
          return { received: true };
        }),
    },
  },
});
