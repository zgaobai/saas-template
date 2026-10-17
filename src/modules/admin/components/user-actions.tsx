import { useI18n } from "@/i18n/react";
import { Coins, UserRoundX, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import type { AdminUser } from "../types";
export function UserActions({
  user,
  onChanged,
}: {
  user: AdminUser;
  onChanged: () => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const [operation, setOperation] = useState<"credits" | "status" | null>(null),
    [amount, setAmount] = useState(20),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [requestId, setRequestId] = useState(""),
    [success, setSuccess] = useState("");
  return (
    <section className="user-actions">
      <div className="user-action-buttons">
        <Button
          variant="primary"
          disabled={user.closed_at !== null || busy}
          onClick={() => {
            setOperation("credits");
            setReason("");
            setSuccess("");
            setError("");
            setRequestId(crypto.randomUUID());
          }}
        >
          <Coins size={16} />
          {tr("发放积分")}
        </Button>
        <Button
          variant={user.disabled_at !== null ? "secondary" : "danger"}
          className="user-status-button"
          disabled={user.closed_at !== null || busy}
          onClick={() => {
            setOperation("status");
            setReason("");
            setSuccess("");
            setError("");
          }}
        >
          {user.disabled_at !== null ? (
            <UserRoundCheck size={16} />
          ) : (
            <UserRoundX size={16} />
          )}
          {user.disabled_at !== null ? tr("恢复账号") : tr("停用账号")}
        </Button>
      </div>
      {success && <Notice kind="success">{success}</Notice>}
      <Modal
        open={operation !== null}
        onClose={() => setOperation(null)}
        busy={busy}
        title={
          operation === "credits"
            ? tr("发放积分")
            : user.disabled_at !== null
              ? tr("恢复账号")
              : tr("停用账号")
        }
        description={tr("填写操作原因，提交后将记录到操作日志。")}
      >
        {operation && (
          <form
            className="user-action-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api(
                  operation === "credits"
                    ? "/api/app/admin/credits"
                    : "/api/app/admin/user-status",
                  {
                    method: "POST",
                    body: JSON.stringify(
                      operation === "credits"
                        ? {
                            userId: user.id,
                            amount,
                            reason,
                            requestId,
                          }
                        : {
                            userId: user.id,
                            disabled: user.disabled_at === null,
                            reason,
                          },
                    ),
                  },
                );
                setSuccess(
                  operation === "credits"
                    ? `已发放 ${amount} 积分`
                    : user.disabled_at !== null
                      ? "账号已恢复"
                      : "账号已停用",
                );
                setOperation(null);
                await onChanged();
              } catch (e) {
                setError(e instanceof Error ? e.message : "操作失败");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="user-action-target">
              <strong>{user.email}</strong>
              <span>{user.name}</span>
            </div>
            {operation === "status" && (
              <p>
                {user.disabled_at !== null
                  ? tr("恢复后，该用户可以重新登录。")
                  : tr("停用后，该用户将退出登录，且无法继续访问账户。")}
              </p>
            )}
            {operation === "credits" && (
              <Field id="user-credit-amount" label={tr("积分数量")}>
                <Input
                  id="user-credit-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min={1}
                  max={10000}
                  required
                  disabled={busy}
                />
              </Field>
            )}
            <Field id="user-action-reason" label={tr("操作原因")}>
              <Input
                id="user-action-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                maxLength={120}
                required
                disabled={busy}
              />
            </Field>
            {error && <Notice kind="error">{tr(error)}</Notice>}
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setOperation(null)}
              >
                {tr("取消")}
              </Button>
              <Button
                type="submit"
                disabled={busy}
                variant={
                  operation === "status" && user.disabled_at === null
                    ? "danger"
                    : "primary"
                }
              >
                {busy
                  ? tr("处理中…")
                  : operation === "credits"
                    ? tr("确认发放")
                    : user.disabled_at !== null
                      ? tr("确认恢复")
                      : tr("确认停用")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
