import { useI18n } from "@/i18n/react";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/date";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useResource } from "@/lib/use-resource";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Loading, Notice, Empty } from "@/components/ui/feedback";
import type { AdminOverview as Overview } from "../types";
export function AdminOverview() {
  const { t: tr, locale } = useI18n();
  const [days, setDays] = useState("7");
  const { data, error, loading, reload } = useResource<Overview>(
    `/api/app/admin/overview?days=${days}`,
    true,
  );
  return (
    <>
      <PageHeading
        title={tr("数据总览")}
        description={tr("了解用户增长、生成任务、支付和积分变化。")}
        action={
          <div className="admin-filter-actions">
            <Select
              className="input"
              aria-label={tr("统计周期")}
              value={days}
              onValueChange={(value) => setDays(value)}
            >
              <option value="1">{tr("最近 24 小时")}</option>
              <option value="7">{tr("最近 7 天")}</option>
              <option value="30">{tr("最近 30 天")}</option>
            </Select>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void reload()}
            >
              {tr("刷新")}
            </Button>
          </div>
        }
      />
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {loading ? (
        <Loading />
      ) : (
        data &&
        !error && (
          <>
            <div className="admin-stats">
              <Link to="/admin/users" search={{}}>
                <span>{tr("新增用户")}</span>
                <strong>{data.users.count}</strong>
                <small>{tr("统计周期内注册")}</small>
              </Link>
              <Link to="/admin/tasks" search={{}}>
                <span>{tr("生成任务")}</span>
                <strong>{data.tasks.count}</strong>
                <small>
                  {tr("成功 {0} · 失败 {1} · 审核拦截 {2} · 进行中 {3}", [
                    data.tasks.completed,
                    data.tasks.failed,
                    data.tasks.blocked,
                    data.tasks.pending,
                  ])}
                </small>
              </Link>
              <Link to="/admin/billing" search={{}}>
                <span>{tr("创建订单")}</span>
                <strong>{data.orders.count}</strong>
                <small>
                  {tr("已付款 {0} · 待确认 {1}", [
                    data.orders.paid,
                    data.orders.pending,
                  ])}
                </small>
              </Link>
              <Link to="/admin/ledger" search={{}}>
                <span>{tr("积分变动")}</span>
                <strong>+{data.credits.issued}</strong>
                <small>
                  {tr("扣减 {0} · 包含购买、赠送、兑换及退回", [
                    data.credits.spent,
                  ])}
                </small>
              </Link>
            </div>
            <section className="admin-section">
              <h2>{tr("实收与退款")}</h2>
              <p className="admin-secondary">
                {tr(
                  "按到账与退款发生时间统计，不含未支付订单；不同币种分别计算。",
                )}
              </p>
              {data.revenue.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr("币种")}</th>
                        <th>{tr("实收")}</th>
                        <th>{tr("退款")}</th>
                        <th>{tr("净收款")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenue.map((r) => (
                        <tr key={r.currency}>
                          <td>{r.currency}</td>
                          <td>{(r.received / 100).toFixed(2)}</td>
                          <td>{(r.refunded / 100).toFixed(2)}</td>
                          <td>
                            {((r.received - r.refunded) / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title={tr("该周期暂无支付流水")}>
                  {tr("收到付款或退款回调后，这里会自动更新。")}
                </Empty>
              )}
            </section>
            <section className="admin-section">
              <h2>{tr("每日生成任务")}</h2>
              <p className="admin-secondary">
                {tr("按北京时间汇总；时间范围内的任务按当前状态统计。")}
              </p>
              {data.daily.length ? (
                <div className="admin-chart">
                  {data.daily.map((d) => (
                    <div key={d.day}>
                      <time>{d.day}</time>
                      <div className="admin-bar-track">
                        <span
                          style={{
                            width: `${(d.count / Math.max(...data.daily.map((d) => d.count), 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span>
                        {tr("{0} 次 / 成功 {1}", [d.count, d.completed])}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title={tr("该周期暂无生成任务")}>
                  {tr("用户开始生成后，这里会显示任务趋势。")}
                </Empty>
              )}
            </section>
            <section className="admin-section">
              <h2>{tr("AI 模型消耗与 Token 成本精算")}</h2>
              <p className="admin-secondary">
                {tr("按底座模型统计调用次数、Token 消耗量、API 成本与积分转化。")}
              </p>
              {data.aiUsage && data.aiUsage.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr("底座模型")}</th>
                        <th>{tr("调用频次 / 成功率")}</th>
                        <th>{tr("Token 消耗 (输入 / 输出 / 总计)")}</th>
                        <th>{tr("API 成本 (USD)")}</th>
                        <th>{tr("扣减积分")}</th>
                        <th>{tr("平均耗时")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.aiUsage.map((m) => {
                        const successRate = m.total_count > 0 ? Math.round((m.completed_count / m.total_count) * 100) : 0;
                        const costUsd = (m.cost_micros / 1000000).toFixed(4);
                        const latencyStr = m.avg_duration_ms ? `${(m.avg_duration_ms / 1000).toFixed(2)}s` : "-";
                        return (
                          <tr key={m.model}>
                            <td>
                              <strong>{m.model}</strong>
                            </td>
                            <td>
                              {m.total_count} {tr("次")}
                              <small className="admin-secondary" style={{ display: "block" }}>
                                {tr("成功率")} {successRate}%
                              </small>
                            </td>
                            <td>
                              <span>{m.total_tokens.toLocaleString()}</span>
                              <small className="admin-secondary" style={{ display: "block" }}>
                                {m.prompt_tokens.toLocaleString()} / {m.completion_tokens.toLocaleString()}
                              </small>
                            </td>
                            <td>
                              <span style={{ color: "var(--color-primary, #6366f1)", fontWeight: 600 }}>
                                ${costUsd}
                              </span>
                            </td>
                            <td>
                              <span>{m.credits_charged.toLocaleString()}</span>
                            </td>
                            <td>{latencyStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title={tr("该周期暂无 AI 模型消耗记录")}>
                  {tr("用户使用 AI 工具生成后，这里会自动生成模型成本报表。")}
                </Empty>
              )}
            </section>
            <p className="admin-secondary">
              {tr("数据更新于")}
              {formatDateTime(data.until, locale)}
            </p>
          </>
        )
      )}
    </>
  );
}
