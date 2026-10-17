import { useI18n } from "@/i18n/react";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/date";
import { taskErrors, taskStatuses, labelFor } from "@/modules/admin/types";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getTool } from "@/modules/tools/catalog";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import type { Generation } from "@/modules/tools/types";
import { PageHeading } from "@/components/layout/page-heading";
import { Loading, Notice } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { TableEmptyRow } from "@/components/ui/table-empty-row";
import { CompactValue } from "@/components/ui/compact-value";
type PageData = {
  history: Generation[];
  nextCursor: string | null;
};
export function TaskList() {
  const { t: tr, locale } = useI18n();
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<string[]>([""]);
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const params = new URLSearchParams({
    search,
    status,
    cursor: cursors.at(-1) || "",
  });
  const { data, loading, error, reload } = useResource<PageData>(
    "/api/app/history?" + params,
    true,
  );
  const selected = data?.history.find((g) => g.id === selectedId);
  return (
    <div className="account-page">
      <PageHeading
        title={tr("任务列表")}
        description={tr("查看每次生成的内容、结果、状态和积分退回情况。")}
        action={
          <Link to="/" className="button button-primary">
            {tr("开始新创作")}
          </Link>
        }
      />
      <form
        className="history-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setCursors([""]);
        }}
      >
        <Field id="history-search" label={tr("搜索创作内容")}>
          <Input
            id="history-search"
            type="search"
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("输入原文或需求中的关键词")}
          />
        </Field>
        <Field id="history-status" label={tr("任务状态")}>
          <Select
            className="input"
            id="history-status"
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setCursors([""]);
            }}
          >
            <option value="">{tr("全部状态")}</option>
            {Object.entries(taskStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" type="submit">
          {tr("搜索")}
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            setQuery("");
            setSearch("");
            setStatus("");
            setCursors([""]);
          }}
        >
          {tr("重置")}
        </Button>
        <Button
          variant="secondary"
          type="button"
          disabled={loading}
          onClick={() => void reload()}
        >
          {tr("刷新")}
        </Button>
      </form>
      {(error || issue) && <Notice kind="error">{error || issue}</Notice>}
      {loading ? (
        <Loading />
      ) : (
        !error &&
        data && (
          <div className="table-wrap account-task-table">
            <table>
              <caption className="sr-only">{tr("生成任务列表")}</caption>
              <thead>
                <tr>
                  <th>{tr("任务编号")}</th>
                  <th>{tr("内容 / 工具")}</th>
                  <th>{tr("状态")}</th>
                  <th>{tr("预扣积分")}</th>
                  <th>{tr("退回积分")}</th>
                  <th>{tr("创建时间")}</th>
                  <th>{tr("操作")}</th>
                </tr>
              </thead>
              <tbody>
                {!data.history.length && (
                  <TableEmptyRow
                    columns={7}
                    message={
                      search || status
                        ? tr("暂无匹配任务，请调整筛选条件。")
                        : tr("暂无生成任务，使用工具后会显示。")
                    }
                  />
                )}
                {data.history.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <CompactValue value={g.id} label={tr("任务编号")} />
                    </td>
                    <td>
                      <span className="table-reason" title={g.prompt}>
                        {g.prompt}
                      </span>
                      <small>
                        {tr(getTool(g.tool_id)?.name || tr("文案生成"))}
                      </small>
                    </td>
                    <td>
                      <span className="badge">
                        {tr(labelFor(taskStatuses, g.status))}
                      </span>
                    </td>
                    <td>{g.cost}</td>
                    <td>{g.refunded}</td>
                    <td>{formatDateTime(g.created_at, locale)}</td>
                    <td>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          setSelectedId(g.id);
                          setCopied("");
                          setIssue("");
                        }}
                      >
                        {tr("查看详情")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId("")}
        title={tr("任务详情")}
        description={
          selected
            ? `${tr(getTool(selected.tool_id)?.name || "文案生成")} · ${tr(labelFor(taskStatuses, selected.status))}`
            : tr("任务详情")
        }
        busy={!!busy}
      >
        {selected && (
          <div className="task-detail-content">
            {issue && <Notice kind="error">{tr(issue)}</Notice>}
            <p className="task-meta">
              {tr("任务编号：{0} · 预扣 {1} 积分 · 已退回{2}{3} 积分 {4}", [
                selected.id,
                selected.cost,
                " ",
                selected.refunded,
                selected.completed_at
                  ? ` · 完成于 ${formatDateTime(selected.completed_at, locale)}`
                  : "",
              ])}
            </p>
            {selected.error_code && (
              <Notice>
                {taskErrors[selected.error_code] || tr("任务未完成")}
              </Notice>
            )}
            <h3>{tr("输入内容")}</h3>
            <pre>{selected.prompt}</pre>
            <h3>{tr("生成结果")}</h3>
            <pre>{selected.output || tr("此任务暂无生成结果。")}</pre>
            <div className="record-actions">
              {selected.output && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selected.output!);
                      setCopied(selected.id);
                    } catch {
                      setIssue("复制失败，请手动选择内容复制。");
                    }
                  }}
                >
                  {copied === selected.id ? tr("已复制") : tr("复制结果")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="small"
                disabled={Boolean(busy) || selected.status === "pending"}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "删除这条创作记录？删除后无法恢复，积分流水会保留。",
                    )
                  )
                    return;
                  setBusy(selected.id);
                  setIssue("");
                  try {
                    await api("/api/app/history/" + selected.id, {
                      method: "DELETE",
                    });
                    setSelectedId("");
                    if (data?.history.length === 1 && cursors.length > 1)
                      setCursors((c) => c.slice(0, -1));
                    else await reload();
                  } catch (e) {
                    setIssue(e instanceof Error ? e.message : "删除失败");
                  } finally {
                    setBusy("");
                  }
                }}
              >
                {busy === selected.id ? tr("正在删除…") : tr("删除记录")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <nav className="admin-pagination" aria-label={tr("任务列表分页")}>
        <span>{tr("第 {0} 页 · 每页 20 条", [cursors.length])}</span>
        <Button
          variant="secondary"
          disabled={loading || cursors.length === 1}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          {tr("上一页")}
        </Button>
        <Button
          variant="secondary"
          disabled={loading || !!error || !data?.nextCursor}
          onClick={() =>
            data?.nextCursor && setCursors((c) => [...c, data.nextCursor!])
          }
        >
          {tr("下一页")}
        </Button>
      </nav>
    </div>
  );
}
