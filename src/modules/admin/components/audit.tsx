import { useI18n } from "@/i18n/react";
import { TableEmptyRow } from "./table-empty-row";
import { CompactValue } from "@/components/ui/compact-value";
import { PageHeading } from "@/components/layout/page-heading";
import { AdminList, DateTime, Person } from "./list";
import type { AdminAudit as Audit } from "../types";
function Action({ value }: { value: string }) {
  const { t: tr, locale } = useI18n();
  const match = /^credit_grant:(\d+):([\s\S]*)$/.exec(value);
  if (match)
    return (
      <>
        {tr("发放")}
        {match[1]}
        {tr("积分")}
        <CompactValue value={match[2]} label={tr("调整原因")} />
      </>
    );
  const labels: Record<string, string> = {
    "account.closed": "注销账户",
    "user.disabled": "停用用户",
    "user.enabled": "恢复用户",
    "plan.updated": "更新套餐",
    "code.created": "创建兑换码",
    "code.disabled": "停用兑换码",
    "code.enabled": "启用兑换码",
    "code.redeemed": "兑换成功",
    "order.reconciled": "核对支付",
  };
  const [key, ...detail] = value.split(":");
  return (
    <>
      {labels[key] || key}
      {detail.length > 0 && (
        <CompactValue value={detail.join(":")} label={tr("操作详情")} />
      )}
    </>
  );
}
export function AdminAudit() {
  const { t: tr, locale } = useI18n();
  return (
    <>
      <PageHeading
        title={tr("操作记录")}
        description={tr("查看操作人、目标对象、调整原因和时间。")}
      />
      <AdminList<Audit>
        endpoint="audit"
        searchHint={tr("输入操作人或目标用户的完整邮箱。")}
        statuses={{
          credit_grant: tr("积分调整"),
          "account.closed": tr("账户注销"),
          user: tr("用户操作"),
          plan: tr("套餐配置"),
          code: tr("兑换操作"),
          order: tr("订单核对"),
        }}
      >
        {(rows) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("操作人")}</th>
                  <th>{tr("目标对象")}</th>
                  <th>{tr("操作内容")}</th>
                  <th>{tr("时间")}</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && <TableEmptyRow columns={4} />}
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Person name={a.actor_name} email={a.actor_email} />
                    </td>
                    <td>
                      {a.target_email ||
                      a.target_name ||
                      /^(credit_grant:|user\.|account\.|code\.redeemed:)/.test(
                        a.action,
                      ) ? (
                        <Person name={a.target_name} email={a.target_email} />
                      ) : (
                        <CompactValue
                          value={a.target_id}
                          label={tr("目标编号")}
                        />
                      )}
                    </td>
                    <td>
                      <Action value={a.action} />
                    </td>
                    <td>
                      <DateTime value={a.created_at} />
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
