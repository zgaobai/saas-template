import { useI18n } from "@/i18n/react";
import { formatDateTime } from "@/lib/date";
import { formatPrice, legacyPlanNames } from "@/modules/billing/plans";
import {
  labelFor,
  orderStatuses,
  subscriptionStatuses,
} from "@/modules/admin/types";
import { Button } from "@/components/ui/button";
import { CompactValue } from "@/components/ui/compact-value";
import { TableEmptyRow } from "@/components/ui/table-empty-row";
import type { BillingRecordPage } from "../types";
export type BillingSection = "subscriptions" | "orders" | "redemptions";
export const billingSections: Record<BillingSection, string> = {
  subscriptions: "订阅记录",
  orders: "订单记录",
  redemptions: "兑换记录",
};
const name = (id: string) => legacyPlanNames[id] || id;
export function BillingRecords({
  data,
  section,
  busy,
  onCancel,
}: {
  data: BillingRecordPage;
  section: BillingSection;
  busy: boolean;
  onCancel: (id: string) => void;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <div className="table-wrap account-record-table">
      {section === "subscriptions" ? (
        <table>
          <caption className="sr-only">{tr("订阅记录")}</caption>
          <thead>
            <tr>
              <th>{tr("套餐")}</th>
              <th>{tr("订阅状态")}</th>
              <th>{tr("已付权益到期")}</th>
              <th>{tr("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {!data.subscriptions.length && (
              <TableEmptyRow
                columns={4}
                message={tr("暂无付费订阅。兑换获得的权益请查看兑换记录。")}
              />
            )}
            {data.subscriptions.map((s) => (
              <tr key={s.id}>
                <td>{tr(s.plan_name || name(s.plan_id))}</td>
                <td>{tr(labelFor(subscriptionStatuses, s.status))}</td>
                <td>
                  {s.paid_until
                    ? formatDateTime(s.paid_until, locale)
                    : tr("尚未付款")}
                </td>
                <td>
                  {[
                    "ACTIVE",
                    "AUTHORIZATION_REQUIRED",
                    "IN_PROGRESS",
                    "PAST_DUE",
                  ].includes(s.status) ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => onCancel(s.id)}
                    >
                      {tr("取消续费")}
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : section === "orders" ? (
        <table>
          <caption className="sr-only">{tr("订单记录")}</caption>
          <thead>
            <tr>
              <th>{tr("订单编号")}</th>
              <th>{tr("套餐")}</th>
              <th>{tr("金额")}</th>
              <th>{tr("状态")}</th>
              <th>{tr("创建时间")}</th>
              <th>{tr("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {!data.orders.length && (
              <TableEmptyRow
                columns={6}
                message={tr("暂无订单，购买套餐或积分包后会显示在这里。")}
              />
            )}
            {data.orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <CompactValue value={o.id} label={tr("订单编号")} />
                </td>
                <td>{tr(o.plan_name || name(o.plan_id))}</td>
                <td>{formatPrice(o.amount, locale)}</td>
                <td>{tr(labelFor(orderStatuses, o.status))}</td>
                <td>{formatDateTime(o.created_at, locale)}</td>
                <td>
                  {o.status === "pending" && o.checkout_url ? (
                    <a
                      className="button button-secondary"
                      href={o.checkout_url}
                      rel="noreferrer"
                    >
                      {tr("继续付款")}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table>
          <caption className="sr-only">{tr("兑换记录")}</caption>
          <thead>
            <tr>
              <th>{tr("兑换内容")}</th>
              <th>{tr("发放积分")}</th>
              <th>{tr("权益到期")}</th>
              <th>{tr("兑换时间")}</th>
            </tr>
          </thead>
          <tbody>
            {!data.redemptions.length && (
              <TableEmptyRow
                columns={4}
                message={tr("暂无兑换记录，使用兑换码后会显示在这里。")}
              />
            )}
            {data.redemptions.map((r) => (
              <tr key={r.id}>
                <td>{tr(r.plan_name || tr("积分"))}</td>
                <td>
                  {r.credits}
                  {r.grant_months === 12
                    ? tr(" 积分/月，共 12 期")
                    : tr(" 积分")}
                </td>
                <td>
                  {r.expires_at
                    ? formatDateTime(r.expires_at, locale)
                    : tr("不适用")}
                </td>
                <td>{formatDateTime(r.created_at, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
