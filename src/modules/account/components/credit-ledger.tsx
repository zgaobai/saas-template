import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CompactValue } from "@/components/ui/compact-value";
import { Select } from "@/components/ui/select";
import { TableEmptyRow } from "@/components/ui/table-empty-row";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Loading, Notice } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/date";
import { useResource } from "@/lib/use-resource";
type LedgerEntry = {
  id: string;
  amount: number;
  reason: string;
  created_at: number;
};
type LedgerData = {
  balance: number;
  summary: {
    spent: number;
    returned: number;
    earned: number;
  };
  items: LedgerEntry[];
  nextCursor: string | null;
};
const filters = {
  "": "全部流水",
  earned: "获得积分",
  spent: "任务扣费",
  returned: "失败退回",
};
function entryKind(entry: LedgerEntry) {
  if (entry.id.startsWith("generation:")) return "任务扣费";
  if (entry.id.startsWith("release:")) return "失败退回";
  return entry.amount > 0
    ? "获得积分"
    : entry.amount < 0
      ? "积分扣减"
      : "积分调整";
}
export function CreditLedger() {
  const { t: tr, locale } = useI18n();
  const [kind, setKind] = useState("");
  const [days, setDays] = useState("30");
  const [cursors, setCursors] = useState([""]);
  const { data, error, loading, reload } = useResource<LedgerData>(
    "/api/app/credits?" +
      new URLSearchParams({
        kind,
        days,
        cursor: cursors.at(-1) || "",
      }),
    true,
  );
  return (
    <div className="account-page credit-ledger-page">
      <PageHeading
        title={tr("积分流水")}
        description={tr("查看可用积分，以及每一笔获得、扣费和退回。")}
      />
      <section className="ledger-balance" aria-label={tr("当前积分余额")}>
        <div>
          <span>{tr("当前可用积分")}</span>
          <strong>
            {data
              ? data.balance.toLocaleString(locale === "en" ? "en-US" : "zh-CN")
              : "—"}
          </strong>
        </div>
        <Link
          className="button button-secondary"
          to="/subscriptions"
          search={{
            section: "subscriptions",
          }}
        >
          {tr("购买与兑换")}
        </Link>
      </section>
      <section
        className="ledger-summary-section"
        aria-labelledby="ledger-summary-title"
      >
        <div className="ledger-section-heading">
          <h2 id="ledger-summary-title">{tr("收支概况")}</h2>
          <Select
            className="input"
            aria-label={tr("统计周期（仅影响收支概况）")}
            value={days}
            onValueChange={setDays}
          >
            <option value="7">{tr("近 7 天")}</option>
            <option value="30">{tr("近 30 天")}</option>
            <option value="90">{tr("近 90 天")}</option>
          </Select>
        </div>
        <dl className="ledger-summary">
          <div>
            <dt>{tr("获得积分")}</dt>
            <dd>
              {data
                ? data.summary.earned.toLocaleString(
                    locale === "en" ? "en-US" : "zh-CN",
                  )
                : "—"}
            </dd>
            <dd className="ledger-summary-note">{tr("购买、赠送与兑换")}</dd>
          </div>
          <div>
            <dt>{tr("任务扣费")}</dt>
            <dd>
              {data
                ? data.summary.spent.toLocaleString(
                    locale === "en" ? "en-US" : "zh-CN",
                  )
                : "—"}
            </dd>
            <dd className="ledger-summary-note">
              {tr("含后续退回的预扣积分")}
            </dd>
          </div>
          <div>
            <dt>{tr("失败退回")}</dt>
            <dd>
              {data
                ? data.summary.returned.toLocaleString(
                    locale === "en" ? "en-US" : "zh-CN",
                  )
                : "—"}
            </dd>
            <dd className="ledger-summary-note">
              {tr("生成失败后退回的积分")}
            </dd>
          </div>
        </dl>
        <p className="ledger-period-note">
          {tr(
            "按近 {0} 天的入账时间统计，当前余额与下方历史流水不受此周期限制。",
            [days],
          )}
        </p>
      </section>
      <section aria-labelledby="ledger-record-title">
        <div className="ledger-section-heading">
          <h2 id="ledger-record-title">{tr("全部历史流水")}</h2>
        </div>
        <div className="account-record-toolbar ledger-toolbar">
          <div className="admin-tabs" role="group" aria-label={tr("流水类型")}>
            {Object.entries(filters).map(([value, label]) => (
              <Button
                key={value}
                variant="ghost"
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setCursors([""]);
                }}
              >
                {tr(label)}
              </Button>
            ))}
          </div>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void reload()}
          >
            {tr("刷新")}
          </Button>
        </div>
        {error && (
          <Notice kind="error">{tr("{0}，请点击刷新重试。", [error])}</Notice>
        )}
        {loading ? (
          <Loading />
        ) : (
          data &&
          !error && (
            <div className="table-wrap ledger-table">
              <table>
                <caption className="sr-only">{tr("全部历史积分流水")}</caption>
                <thead>
                  <tr>
                    <th>{tr("类型 / 事项")}</th>
                    <th>{tr("积分变动")}</th>
                    <th>{tr("状态")}</th>
                    <th>{tr("入账时间")}</th>
                    <th>{tr("流水编号")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.items.length && (
                    <TableEmptyRow
                      columns={5}
                      message={
                        kind ? tr("暂无此类型的积分流水") : tr("暂无积分流水")
                      }
                    />
                  )}
                  {data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <strong className="ledger-entry-kind">
                          {tr(entryKind(entry))}
                        </strong>
                        <span className="table-reason" title={tr(entry.reason)}>
                          {tr(entry.reason)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`ledger-amount${entry.amount > 0 ? " positive" : ""}`}
                        >
                          {entry.amount > 0 ? "+" : ""}
                          {entry.amount.toLocaleString(
                            locale === "en" ? "en-US" : "zh-CN",
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 500,
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                          }}
                        >
                          {tr("已入账")}
                        </span>
                      </td>
                      <td>{formatDateTime(entry.created_at, locale)}</td>
                      <td>
                        <CompactValue value={entry.id} label={tr("流水编号")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        <nav className="admin-pagination" aria-label={tr("积分流水分页")}>
          <span>{tr("第 {0} 页 · 每页 25 条", [cursors.length])}</span>
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
            onClick={() => {
              if (data?.nextCursor) setCursors((c) => [...c, data.nextCursor!]);
            }}
          >
            {tr("下一页")}
          </Button>
        </nav>
      </section>
    </div>
  );
}
