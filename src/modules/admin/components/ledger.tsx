import { useI18n } from "@/i18n/react";
import { TableEmptyRow } from "./table-empty-row";
import { CompactValue } from "@/components/ui/compact-value";
import { Link } from "@tanstack/react-router";
import { PageHeading } from "@/components/layout/page-heading";
import { AdminList, Person, DateTime } from "./list";
import type { AdminLedger as Ledger } from "../types";
export function getLedgerMeta(l: {
  id: string;
  amount: number;
  reason?: string;
}) {
  if (l.id.startsWith("generation:")) {
    return {
      label: "任务扣费",
      color: "#2563eb",
      bg: "rgba(37, 99, 235, 0.12)",
    };
  }
  if (l.id.startsWith("release:")) {
    return {
      label: "失败退回",
      color: "#059669",
      bg: "rgba(5, 150, 105, 0.12)",
    };
  }
  if (l.id.startsWith("payment:")) {
    return {
      label: "充值购买",
      color: "#7c3aed",
      bg: "rgba(124, 58, 237, 0.12)",
    };
  }
  if (l.id.startsWith("redeem-month:") || l.id.startsWith("installment:")) {
    return {
      label: "周期配额",
      color: "#0891b2",
      bg: "rgba(8, 145, 178, 0.12)",
    };
  }
  if (l.id.startsWith("redeem:")) {
    return {
      label: "卡密兑换",
      color: "#d97706",
      bg: "rgba(217, 119, 6, 0.12)",
    };
  }
  if (l.id.startsWith("refund:") || l.reason?.includes("退款")) {
    return {
      label: "退款撤回",
      color: "#dc2626",
      bg: "rgba(220, 38, 38, 0.12)",
    };
  }
  return {
    label: l.amount > 0 ? "系统增补" : "系统扣除",
    color: "#4b5563",
    bg: "rgba(107, 114, 128, 0.12)",
  };
}

export function AdminLedger() {
  const { t: tr, locale } = useI18n();
  return (
    <>
      <PageHeading
        title={tr("积分流水")}
        description={tr("追踪购买、兑换、生成扣费、失败退回和管理员调整。")}
      />
      <AdminList<Ledger>
        endpoint="ledger"
        searchPlaceholder={tr("输入完整邮箱或流水编号")}
        statuses={{
          spent: tr("任务扣费"),
          returned: tr("失败退回"),
          payment: tr("充值购买"),
          subscription: tr("周期配额"),
          redeem: tr("卡密兑换"),
          refund: tr("退款撤回"),
          adjustment: tr("系统调整"),
        }}
        searchHint={tr("支持完整邮箱或流水编号。")}
      >
        {(rows) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("用户")}</th>
                  <th>{tr("流水类型")}</th>
                  <th>{tr("积分变动")}</th>
                  <th>{tr("状态")}</th>
                  <th>{tr("原因 / 流水编号")}</th>
                  <th>{tr("时间")}</th>
                  <th>{tr("关联记录")}</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && <TableEmptyRow columns={7} />}
                {rows.map((l) => {
                  const meta = getLedgerMeta(l);
                  return (
                    <tr key={l.id}>
                      <td>
                        <Person name={l.name} email={l.email} />
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 500,
                            background: meta.bg,
                            color: meta.color,
                          }}
                        >
                          {tr(meta.label)}
                        </span>
                      </td>
                      <td className={l.amount > 0 ? "positive" : ""}>
                        {l.amount > 0 ? "+" : ""}
                        {l.amount}
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
                      <td>
                        <span className="table-reason" title={l.reason}>
                          {l.reason}
                        </span>
                        <CompactValue value={l.id} label={tr("流水编号")} />
                      </td>
                      <td>
                        <DateTime value={l.created_at} />
                      </td>
                      <td>
                        {l.order_id ? (
                          <Link
                            to="/admin/billing"
                            search={{
                              q: l.order_id,
                            }}
                          >
                            {tr("查看订单")}
                          </Link>
                        ) : l.id.startsWith("generation:") ||
                          l.id.startsWith("release:") ? (
                          <Link
                            to="/admin/tasks"
                            search={{
                              q: l.id.slice(l.id.indexOf(":") + 1),
                            }}
                          >
                            {tr("查看任务")}
                          </Link>
                        ) : l.id.startsWith("redeem:") ? (
                          <Link
                            to="/admin/codes"
                            search={{
                              q: l.email,
                            }}
                          >
                            {tr("兑换记录")}
                          </Link>
                        ) : (
                          <Link
                            to="/admin/users"
                            search={{
                              q: l.email,
                            }}
                          >
                            {tr("查看用户")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminList>
    </>
  );
}
