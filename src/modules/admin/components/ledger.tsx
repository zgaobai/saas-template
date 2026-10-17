import { useI18n } from "@/i18n/react";
import { TableEmptyRow } from "./table-empty-row";
import { CompactValue } from "@/components/ui/compact-value";
import { Link } from "@tanstack/react-router";
import { PageHeading } from "@/components/layout/page-heading";
import { AdminList, Person, DateTime } from "./list";
import type { AdminLedger as Ledger } from "../types";
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
          in: tr("增加积分"),
          out: tr("扣减积分"),
        }}
        searchHint={tr("支持完整邮箱或流水编号。")}
      >
        {(rows) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("用户")}</th>
                  <th>{tr("积分变动")}</th>
                  <th>{tr("原因 / 流水编号")}</th>
                  <th>{tr("时间")}</th>
                  <th>{tr("关联记录")}</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && <TableEmptyRow columns={5} />}
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Person name={l.name} email={l.email} />
                    </td>
                    <td className={l.amount > 0 ? "positive" : ""}>
                      {l.amount > 0 ? "+" : ""}
                      {l.amount}
                    </td>
                    <td>
                      <span className="table-reason" title={l.reason}>
                        {l.reason}
                      </span>
                      <CompactValue value={l.id} label={tr("记录编号")} />
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminList>
    </>
  );
}
