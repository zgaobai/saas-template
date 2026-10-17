import { useI18n } from "@/i18n/react";
import {
  RedemptionRecordCells,
  redemptionHeadings,
} from "./redemption-record-cells";
import { TableEmptyRow } from "./table-empty-row";
import { Fragment, useState } from "react";
import { useResource } from "@/lib/use-resource";
import { Button } from "@/components/ui/button";
import { Loading, Notice } from "@/components/ui/feedback";
import { CompactValue } from "@/components/ui/compact-value";
import { getTool } from "@/modules/tools/catalog";
import { formatPrice, legacyPlanNames } from "@/modules/billing/plans";
import { DateTime } from "./list";
import { AdminPagination } from "./pagination";
import {
  taskStatuses,
  orderStatuses,
  subscriptionStatuses,
  paymentProviders,
  labelFor,
  type AdminPage,
  type UserRecord,
  type TaskDetail,
} from "../types";
import type { UserRecordSection } from "./user-detail";
const columns: Record<UserRecordSection, string[]> = {
  tasks: [
    "任务 / 编号",
    "状态",
    "预扣积分",
    "已退回积分",
    "提交 / 完成时间",
    "操作",
  ],
  ledger: ["原因 / 流水编号", "积分变动", "时间"],
  orders: [
    "套餐 / 订单编号",
    "订单金额",
    "套餐积分",
    "支付渠道",
    "状态",
    "创建时间",
  ],
  subscriptions: [
    "套餐 / 订阅编号",
    "支付渠道",
    "订阅状态",
    "已付权益到期",
    "更新时间",
    "关联订单",
  ],
  redemptions: redemptionHeadings,
};
export function UserRecords({
  userId,
  section,
}: {
  userId: string;
  section: UserRecordSection;
}) {
  const { t: tr, locale } = useI18n();
  const [cursors, setCursors] = useState([""]),
    [taskId, setTaskId] = useState<string | null>(null);
  const { data, error, loading, reload } = useResource<AdminPage<UserRecord>>(
    `/api/app/admin/users/${encodeURIComponent(userId)}/${section}?cursor=${encodeURIComponent(cursors.at(-1) || "")}`,
  );
  const headings = columns[section];
  return (
    <div className="user-records">
      {error && (
        <Notice kind="error">
          {tr(error)}
          <Button variant="ghost" onClick={() => void reload()}>
            {tr("重试")}
          </Button>
        </Notice>
      )}
      {loading ? (
        <Loading />
      ) : (
        data &&
        !error && (
          <>
            <div className="table-wrap">
              <table
                aria-label={
                  {
                    tasks: tr("用户任务列表"),
                    ledger: tr("用户积分流水"),
                    orders: tr("用户订单记录"),
                    subscriptions: tr("用户订阅记录"),
                    redemptions: tr("用户兑换记录"),
                  }[section]
                }
              >
                <thead>
                  <tr>
                    {headings.map((label) => (
                      <th key={label} scope="col">
                        {tr(label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!data.items.length && (
                    <TableEmptyRow
                      columns={headings.length}
                      message={tr("暂无相关记录")}
                    />
                  )}
                  {data.items.map((r) => (
                    <Fragment key={r.id}>
                      <tr>
                        {section === "tasks" && (
                          <>
                            <td>
                              <span className="table-reason">
                                {tr(
                                  getTool(r.tool_id || "")?.name ||
                                    tr("生成任务"),
                                )}
                              </span>
                              <CompactValue
                                value={r.id}
                                label={tr("任务编号")}
                              />
                            </td>
                            <td>
                              {tr(labelFor(taskStatuses, r.status || ""))}
                            </td>
                            <td>{r.cost ?? 0}</td>
                            <td>{r.refunded ?? 0}</td>
                            <td>
                              <DateTime value={r.created_at ?? 0} />
                              <small className="admin-secondary">
                                {tr("完成： {0}", [
                                  r.completed_at ? (
                                    <DateTime value={r.completed_at} />
                                  ) : (
                                    "—"
                                  ),
                                ])}
                              </small>
                            </td>
                            <td>
                              <Button
                                variant="ghost"
                                aria-expanded={taskId === r.id}
                                aria-controls={`task-content-${r.id}`}
                                onClick={() =>
                                  setTaskId(taskId === r.id ? null : r.id)
                                }
                              >
                                {taskId === r.id
                                  ? tr("收起内容")
                                  : tr("查看内容")}
                              </Button>
                            </td>
                          </>
                        )}
                        {section === "ledger" && (
                          <>
                            <td>
                              <span className="table-reason">
                                {r.reason || "—"}
                              </span>
                              <CompactValue
                                value={r.id}
                                label={tr("流水编号")}
                              />
                            </td>
                            <td
                              className={(r.amount ?? 0) > 0 ? "positive" : ""}
                            >
                              {(r.amount ?? 0) > 0 ? "+" : ""}
                              {r.amount ?? 0}
                            </td>
                            <td>
                              <DateTime value={r.created_at ?? 0} />
                            </td>
                          </>
                        )}
                        {tr(
                          section === "orders" && (
                            <>
                              <td>
                                <span className="table-reason">
                                  {tr(r.plan_name || tr("套餐"))}
                                </span>
                                <CompactValue
                                  value={r.id}
                                  label={tr("订单编号")}
                                />
                              </td>
                              <td>{formatPrice(r.amount ?? 0, locale)}</td>
                              <td>
                                {r.credits ?? 0}
                                {r.billing_interval ? tr(" / 月") : tr(" / 次")}
                                {r.billing_interval === "year" && (
                                  <small className="admin-secondary">
                                    {tr("年付分 12 期")}
                                  </small>
                                )}
                              </td>
                              <td>
                                {tr(
                                  labelFor(paymentProviders, r.provider || ""),
                                )}
                              </td>
                              <td>
                                {tr(labelFor(orderStatuses, r.status || ""))}
                              </td>
                              <td>
                                <DateTime value={r.created_at ?? 0} />
                              </td>
                            </>
                          ),
                        )}
                        {tr(
                          section === "subscriptions" && (
                            <>
                              <td>
                                <span className="table-reason">
                                  {tr(
                                    r.plan_name ||
                                      legacyPlanNames[r.plan_id || ""] ||
                                      r.plan_id ||
                                      tr("套餐"),
                                  )}
                                </span>
                                <CompactValue
                                  value={r.id}
                                  label={tr("订阅编号")}
                                />
                              </td>
                              <td>
                                {tr(
                                  labelFor(paymentProviders, r.provider || ""),
                                )}
                              </td>
                              <td>
                                {tr(
                                  labelFor(
                                    subscriptionStatuses,
                                    r.status || "",
                                  ),
                                )}
                              </td>
                              <td>
                                <DateTime value={r.paid_until ?? 0} />
                                <small className="admin-secondary">
                                  {(r.paid_until ?? 0) > Date.now()
                                    ? tr("已付权益有效")
                                    : (r.paid_until ?? 0) > 0
                                      ? tr("已付权益已到期")
                                      : tr("尚无已付权益")}
                                </small>
                              </td>
                              <td>
                                <DateTime value={r.updated_at ?? 0} />
                              </td>
                              <td>
                                {r.order_id ? (
                                  <CompactValue
                                    value={r.order_id}
                                    label={tr("关联订单编号")}
                                  />
                                ) : (
                                  "—"
                                )}
                              </td>
                            </>
                          ),
                        )}
                        {section === "redemptions" && (
                          <RedemptionRecordCells record={r} />
                        )}
                      </tr>
                      {section === "tasks" && taskId === r.id && (
                        <tr>
                          <td colSpan={headings.length}>
                            <UserTaskContent id={r.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={cursors.length}
              count={data.items.length}
              hasNext={!!data.nextCursor}
              onPrevious={() => {
                setTaskId(null);
                setCursors((c) => c.slice(0, -1));
              }}
              onNext={() => {
                setTaskId(null);
                setCursors((c) => [...c, data.nextCursor!]);
              }}
            />
          </>
        )
      )}
    </div>
  );
}
function UserTaskContent({ id }: { id: string }) {
  const { t: tr, locale } = useI18n();
  const { data, error, loading } = useResource<TaskDetail>(
    `/api/app/admin/tasks/${encodeURIComponent(id)}`,
  );
  return (
    <div className="user-task-content" id={`task-content-${id}`}>
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice kind="error">{tr(error)}</Notice>
      ) : (
        data && (
          <>
            {Boolean(data.model || data.total_tokens || data.cost_micros) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 my-2">
                {Boolean(data.model) && (
                  <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono">
                    {data.model}
                  </span>
                )}
                {Boolean(
                  data.total_tokens ||
                    data.prompt_tokens ||
                    data.completion_tokens,
                ) && (
                  <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                    Tokens:{" "}
                    {data.total_tokens ||
                      (data.prompt_tokens || 0) +
                        (data.completion_tokens || 0)}{" "}
                    (入 {data.prompt_tokens || 0} / 出{" "}
                    {data.completion_tokens || 0})
                  </span>
                )}
                {Boolean(data.cost_micros && data.cost_micros > 0) && (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">
                    {tr("底座成本: ${0}", [
                      ((data.cost_micros || 0) / 1000000).toFixed(4),
                    ])}
                  </span>
                )}
              </div>
            )}
            <h4>{tr("输入内容")}</h4>
            <pre>{data.prompt}</pre>
            <h4>{tr("生成结果")}</h4>
            <pre>{data.output || tr("暂无生成结果")}</pre>
          </>
        )
      )}
    </div>
  );
}
