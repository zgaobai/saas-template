import { useI18n } from "@/i18n/react";
import { formatDateTime } from "@/lib/date";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
type Reward = {
  credits: number;
  grant_months: number;
  starts_at: number;
  plan_name: string | null;
  expires_at: number;
  alreadyRedeemed: boolean;
};
export function RedeemCode({
  onRedeem,
  onBusyChange,
}: {
  onRedeem: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t: tr, locale } = useI18n();
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState<Reward | null>(null);
  return (
    <form
      className="redeem-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        onBusyChange?.(true);
        setError("");
        setMessage(null);
        try {
          const r = await api<{
            credits: number;
            grant_months: number;
            starts_at: number;
            plan_name: string | null;
            expires_at: number;
            alreadyRedeemed: boolean;
          }>("/api/app/redeem", {
            method: "POST",
            body: JSON.stringify({
              code,
            }),
          });
          setMessage(r);
          setCode("");
          await onRedeem();
        } catch (e) {
          setError(e instanceof Error ? e.message : "兑换失败，请稍后重试。");
        } finally {
          setBusy(false);
          onBusyChange?.(false);
        }
      }}
    >
      <Field id="redeem-code" label={tr("兑换积分或套餐")}>
        <Input
          id="redeem-code"
          placeholder={tr("输入 6 位兑换码（也支持旧版长码）")}
          value={code}
          minLength={6}
          maxLength={90}
          required
          autoComplete="off"
          disabled={busy}
          onChange={(e) => setCode(e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? tr("兑换中…") : tr("立即兑换")}
      </Button>
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {message && (
        <Notice kind="success">
          {tr(
            message.alreadyRedeemed ? "此码已兑换，不会重复发放" : "兑换成功",
          )}{" "}
          · {tr(message.plan_name || "积分")} · {message.credits}{" "}
          {tr(message.grant_months === 12 ? "积分/月，共 12 期" : "积分")}
          {message.grant_months === 12 && (
            <>
              {" "}
              ·{" "}
              {tr("首期发放：{0}", [formatDateTime(message.starts_at, locale)])}
            </>
          )}
          {message.expires_at > 0 && (
            <>
              {" "}
              ·{" "}
              {tr("套餐权益至 {0}", [
                formatDateTime(message.expires_at, locale),
              ])}
            </>
          )}
        </Notice>
      )}
    </form>
  );
}
