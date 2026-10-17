import { useI18n } from "@/i18n/react";
import { TableEmptyRow } from "./table-empty-row";
import { CompactValue } from "@/components/ui/compact-value";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useResource } from "@/lib/use-resource";
import { getTool } from "@/modules/tools/catalog";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Loading, Notice } from "@/components/ui/feedback";
import { AdminList, Person, DateTime } from "./list";
import {
  taskStatuses,
  taskErrors,
  labelFor,
  type AdminTask,
  type TaskDetail,
} from "../types";
export function AdminTasks() {
  const { t: tr, locale } = useI18n();
  const [id, setId] = useState("");
  return (
    <>
      <PageHeading
        title={tr("生成任务")}
        description={tr("查看每次提交的生成任务、执行状态和积分消耗。")}
      />
      <AdminList<AdminTask>
        endpoint="tasks"
        searchPlaceholder={tr("输入完整邮箱或任务编号")}
        statuses={taskStatuses}
        searchHint={tr("输入完整邮箱或任务编号。")}
      >
        {(rows) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("用户 / 任务")}</th>
                  <th>{tr("工具")}</th>
                  <th>{tr("状态")}</th>
                  <th>{tr("预扣积分")}</th>
                  <th>{tr("提交 / 完成时间")}</th>
                  <th>{tr("操作")}</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && <TableEmptyRow columns={6} />}
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Person name={tr(t.name)} email={t.email} />
                      <CompactValue value={t.id} label={tr("记录编号")} />
                    </td>
                    <td>{tr(getTool(t.tool_id)?.name ?? t.tool_id)}</td>
                    <td>
                      {tr(labelFor(taskStatuses, t.status))}
                      {t.error_code && (
                        <small className="admin-secondary">
                          {taskErrors[t.error_code] ?? tr("任务未完成")}
                        </small>
                      )}
                    </td>
                    <td>
                      {t.cost}
                      <small className="admin-secondary">
                        {t.status === "failed" && t.cost > 0
                          ? tr("已退回 {0} 积分", [t.refunded])
                          : t.status === "blocked"
                            ? tr("未扣积分")
                            : ""}
                      </small>
                    </td>
                    <td>
                      <DateTime value={t.created_at} />
                      <small className="admin-secondary">
                        {tr("完成： {0}", [
                          t.completed_at ? (
                            <DateTime value={t.completed_at} />
                          ) : (
                            "—"
                          ),
                        ])}
                      </small>
                    </td>
                    <td>
                      <Button variant="ghost" onClick={() => setId(t.id)}>
                        {tr("查看内容")}
                      </Button>
                      <Link
                        to="/admin/ledger"
                        search={{
                          q: t.email,
                        }}
                      >
                        {tr("积分流水")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminList>
      {id && <TaskContent id={id} close={() => setId("")} />}
    </>
  );
}
function TaskContent({ id, close }: { id: string; close: () => void }) {
  const { t: tr, locale } = useI18n();
  const { data, error, loading } = useResource<TaskDetail>(
    `/api/app/admin/tasks/${encodeURIComponent(id)}`,
  );
  return (
    <section className="admin-section admin-task-detail">
      <div className="admin-detail-title">
        <h2>{tr("任务内容")}</h2>
        <Button variant="secondary" onClick={close}>
          {tr("关闭")}
        </Button>
      </div>
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {loading ? (
        <Loading />
      ) : (
        data &&
        !error && (
          <>
            <Person name={data.name} email={data.email} />
            <p className="admin-secondary">
              {tr("任务编号：{0} · {1}", [data.id, data.tone])}
            </p>
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
            <h3>{tr("用户输入")}</h3>
            <pre>{data.prompt}</pre>
            <h3>{tr("生成结果")}</h3>
            <pre>{data.output || tr("暂无生成结果")}</pre>
          </>
        )
      )}
    </section>
  );
}
