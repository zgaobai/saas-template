import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
export function MutationButton({
  path,
  payload,
  label,
  onDone,
}: {
  path: string;
  payload: unknown;
  label: string;
  onDone: () => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const result = await api<{
              failed?: number;
              needsSupport?: number;
              pending?: number;
            }>(path, {
              method: "POST",
              body: JSON.stringify(payload),
            });
            if (result.failed || result.needsSupport) {
              setMessage(
                result.needsSupport
                  ? "渠道无法自动查询此订单，请到原渠道后台核对。"
                  : "暂时无法查询支付渠道，请稍后重试。",
              );
            } else {
              await onDone();
            }
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "操作失败");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? tr("处理中…") : label}
      </Button>
      {message && <Notice kind="error">{tr(message)}</Notice>}
    </>
  );
}
