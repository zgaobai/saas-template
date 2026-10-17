import { useI18n } from "@/i18n/react";
import { TableEmptyRow } from "./table-empty-row";
import { Link } from "@tanstack/react-router";
import { PageHeading } from "@/components/layout/page-heading";
import { AdminList, DateTime, Person } from "./list";
import { registrationMethods, type AdminUser } from "../types";
export function AdminUsers() {
  const { t: tr, locale } = useI18n();
  return (
    <>
      <PageHeading
        title={tr("用户管理")}
        description={tr(
          "查看用户来源、验证状态和账户权益，在详情中处理用户相关记录。",
        )}
      />
      <AdminList<AdminUser>
        endpoint="users"
        searchHint={tr("输入完整邮箱查询用户。")}
        statuses={{
          active: tr("正常"),
          disabled: tr("已停用"),
          closed: tr("已注销"),
        }}
      >
        {(users) => <UsersTable users={users} />}
      </AdminList>
    </>
  );
}
function UsersTable({ users }: { users: AdminUser[] }) {
  const { t: tr, locale } = useI18n();
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("邮箱 / 昵称")}</th>
              <th>{tr("注册方式")}</th>
              <th>{tr("邮箱验证")}</th>
              <th>{tr("账号状态")}</th>
              <th>{tr("可用积分")}</th>
              <th>{tr("注册时间")}</th>
              <th>{tr("操作")}</th>
            </tr>
          </thead>
          <tbody>
            {!users.length && <TableEmptyRow columns={7} />}
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Person name={u.name} email={u.email} />
                </td>
                <td>
                  {registrationMethods[u.registration_provider || ""] ||
                    tr("暂无记录")}
                </td>
                <td>
                  <span
                    className={`verification-state ${u.email_verified ? "is-verified" : ""}`}
                  >
                    {u.email_verified ? tr("已验证") : tr("未验证")}
                  </span>
                </td>
                <td>
                  {u.closed_at !== null
                    ? tr("已注销")
                    : u.disabled_at !== null
                      ? tr("已停用")
                      : tr("正常")}
                </td>
                <td>{u.balance}</td>
                <td>
                  <DateTime value={u.created_at} />
                </td>
                <td>
                  <Link
                    to="/admin/users/$userId"
                    params={{
                      userId: u.id,
                    }}
                    search={{}}
                    className="button button-secondary button-small"
                  >
                    {tr("查看详情")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
