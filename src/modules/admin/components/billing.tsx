import { useI18n } from "@/i18n/react";
import { TableEmptyRow } from "./table-empty-row";
import { MutationButton } from "./mutation";
import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { legacyPlanNames } from "@/modules/billing/plans";
import { AdminList, DateTime, Person } from "./list";
import {
  labelFor,
  orderStatuses,
  subscriptionStatuses,
  paymentProviders,
} from "../types";
import type { AdminOrder, AdminSubscription } from "../types";
const planName = (id: string) => legacyPlanNames[id] ?? id;
export function AdminBilling() {
  const { t: tr, locale } = useI18n();
  const [view, setView] = useState<"orders" | "subscriptions">("orders");
  return (
    <>
      <PageHeading
        title={tr("订单与订阅")}
        description={tr("查看付款与续费状态。以下为最近一次渠道同步结果。")}
      />
      <div className="admin-tabs" role="group" aria-label={tr("账务视图")}>
        <Button
          variant={view === "orders" ? "primary" : "secondary"}
          aria-pressed={view === "orders"}
          onClick={() => setView("orders")}
        >
          {tr("订单")}
        </Button>
        <Button
          variant={view === "subscriptions" ? "primary" : "secondary"}
          aria-pressed={view === "subscriptions"}
          onClick={() => setView("subscriptions")}
        >
          {tr("订阅")}
        </Button>
      </div>
      {view === "orders" ? (
        <AdminList<AdminOrder>
          key="orders"
          endpoint="orders"
          searchPlaceholder={tr("输入完整邮箱或订单号")}
          statuses={orderStatuses}
          providers
          searchHint={tr("支持完整邮箱、订单号或渠道订单号。")}
        >
          {(rows, reload) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr("订单 / 用户")}</th>
                    <th>{tr("套餐")}</th>
                    <th>{tr("订单金额")}</th>
                    <th>{tr("支付渠道")}</th>
                    <th>{tr("状态")}</th>
                    <th>{tr("创建时间")}</th>
                    <th>{tr("操作")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!rows.length && <TableEmptyRow columns={7} />}
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Person name={o.name} email={o.email} />
                        <details className="admin-details">
                          <summary>{tr("订单编号")}</summary>
                          <dl>
                            <dt>{tr("站内订单号")}</dt>
                            <dd>{o.id}</dd>
                            <dt>{tr("渠道订单号")}</dt>
                            <dd>{o.provider_id || tr("尚未返回")}</dd>
                          </dl>
                        </details>
                      </td>
                      <td>
                        {tr(o.plan_name || planName(o.plan_id))}
                        <small className="admin-secondary">
                          {tr("{0} 积分 {1}{2}", [
                            o.credits,
                            o.billing_interval ? " / 月" : " / 次到账",
                            o.billing_interval === "year"
                              ? "（年付分 12 期）"
                              : "",
                          ])}
                        </small>
                      </td>
                      <td>
                        {o.currency} {(o.amount / 100).toFixed(2)}
                      </td>
                      <td>{tr(labelFor(paymentProviders, o.provider))}</td>
                      <td>
                        {tr(labelFor(orderStatuses, o.status))}
                        {o.status === "pending" && !o.provider_id && (
                          <small className="admin-secondary">
                            {tr("渠道创建结果待核对")}
                          </small>
                        )}
                      </td>
                      <td>
                        <DateTime value={o.created_at} />
                      </td>
                      <td>
                        {["pending", "paid"].includes(o.status) && (
                          <MutationButton
                            path="/api/app/admin/reconcile"
                            payload={{
                              id: o.id,
                            }}
                            label={tr("核对支付")}
                            onDone={reload}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminList>
      ) : (
        <AdminList<AdminSubscription>
          key="subscriptions"
          endpoint="subscriptions"
          searchPlaceholder={tr("输入完整邮箱或订阅编号")}
          statuses={subscriptionStatuses}
          providers
          searchHint={tr("支持完整邮箱、关联订单号或订阅编号。")}
        >
          {(rows) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr("订阅 / 用户")}</th>
                    <th>{tr("套餐 / 渠道")}</th>
                    <th>{tr("续费状态")}</th>
                    <th>{tr("已付权益至")}</th>
                    <th>{tr("更新时间")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!rows.length && <TableEmptyRow columns={5} />}
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Person name={s.name} email={s.email} />
                        <details className="admin-details">
                          <summary>{tr("订阅编号")}</summary>
                          <dl>
                            <dt>{tr("站内订阅号")}</dt>
                            <dd>{s.id}</dd>
                            <dt>{tr("渠道订阅号")}</dt>
                            <dd>{s.provider_id}</dd>
                            <dt>{tr("关联订单号")}</dt>
                            <dd>{s.order_id}</dd>
                          </dl>
                        </details>
                      </td>
                      <td>
                        {tr(s.plan_name || planName(s.plan_id))}
                        <small className="admin-secondary">
                          {tr(labelFor(paymentProviders, s.provider))}
                        </small>
                      </td>
                      <td>{tr(labelFor(subscriptionStatuses, s.status))}</td>
                      <td>
                        <DateTime value={s.paid_until} />
                        <small className="admin-secondary">
                          {s.paid_until > Date.now()
                            ? tr("已付权益有效")
                            : s.paid_until > 0
                              ? tr("已付权益已到期")
                              : tr("尚无已付权益")}
                        </small>
                      </td>
                      <td>
                        <DateTime value={s.updated_at} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminList>
      )}
    </>
  );
}
