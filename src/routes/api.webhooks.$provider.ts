import { createFileRoute } from "@tanstack/react-router";
import { integratedProvider } from "@/modules/billing/server/providers/registry";
import { applyReconciliation } from "@/modules/billing/server/reconciliation";
import { notifyFeishuWebhookError } from "@/modules/billing/server/feishu-notify";
import { endpoint } from "@/server/http";

export const Route = createFileRoute("/api/webhooks/$provider")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        endpoint(async () => {
          let p;
          try {
            p = integratedProvider(params.provider);
          } catch (err) {
            throw err;
          }

          let result;
          try {
            result = await p.handleWebhook(request);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await notifyFeishuWebhookError({
              provider: p.id,
              stage: "webhook_handling",
              errorMessage: msg,
            }).catch(() => {});
            throw err;
          }

          try {
            await applyReconciliation(p.id, result);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const firstPayment = result.payments?.[0];
            const firstSub = result.subscriptions?.[0];
            await notifyFeishuWebhookError({
              provider: p.id,
              stage: "reconciliation",
              orderId: firstPayment?.orderId || firstSub?.orderId,
              userId: firstPayment?.userId || firstSub?.userId,
              paymentId: firstPayment?.paymentId,
              errorMessage: msg,
            }).catch(() => {});
            throw err;
          }

          return { received: true };
        }),
    },
  },
});
