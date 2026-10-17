import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeading } from "@/components/layout/page-heading";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/use-resource";
import { formatDateTime } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Notice, Loading } from "@/components/ui/feedback";
import { UserActions } from "./user-actions";
import { UserRecords } from "./user-records";
import { registrationMethods, type AdminUserDetail } from "../types";
export type UserRecordSection =
  "tasks" | "ledger" | "orders" | "subscriptions" | "redemptions";
export function UserDetail({
  userId,
  section,
  onSectionChange,
}: {
  userId: string;
  section: UserRecordSection;
  onSectionChange: (section: UserRecordSection) => void;
}) {
  const { t: tr, locale } = useI18n();
  const { data, error, loading, reload } = useResource<AdminUserDetail>(
    `/api/app/admin/users/${encodeURIComponent(userId)}`,
    true,
  );
  const [version, setVersion] = useState(0);
  async function refresh() {
    await reload();
    setVersion((v) => v + 1);
  }
  return (
    <section className="user-detail-page">
      <Link to="/admin/users" search={{}} className="user-detail-back">
        <ArrowLeft size={16} />
        {tr("返回用户列表")}
      </Link>
      <PageHeading
        title={tr("用户详情")}
        description={tr("查看账户信息、权益与相关记录。")}
        action={
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} />
            {tr("刷新")}
          </Button>
        }
      />
      <div className="user-detail-body">
        {error && (
          <Notice kind="error">
            {tr(error)}
            <Button variant="ghost" onClick={() => void reload()}>
              {tr("重试")}
            </Button>
          </Notice>
        )}
        {loading && !data ? (
          <Loading />
        ) : (
          data &&
          !error && (
            <>
              <div className="user-profile-heading">
                <div>
                  <h2>{data.user.email}</h2>
                  <p className="user-profile-email">{data.user.name}</p>
                </div>
                <UserActions user={data.user} onChanged={refresh} />
              </div>
              <dl className="user-profile-facts">
                <div>
                  <dt>{tr("注册方式")}</dt>
                  <dd>
                    {registrationMethods[
                      data.user.registration_provider || ""
                    ] || tr("暂无记录")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("可用登录方式")}</dt>
                  <dd>
                    {[
                      data.user.has_password ? tr("邮箱密码") : "",
                      data.user.has_google ? "Google" : "",
                    ]
                      .filter(Boolean)
                      .join("、") || tr("暂无记录")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("邮箱验证")}</dt>
                  <dd>
                    {data.user.email_verified ? tr("已验证") : tr("未验证")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("账号状态")}</dt>
                  <dd>
                    {data.user.closed_at !== null
                      ? tr("已注销")
                      : data.user.disabled_at !== null
                        ? tr("已停用")
                        : tr("正常")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("可用积分")}</dt>
                  <dd className="user-balance">{data.user.balance}</dd>
                </div>
                <div>
                  <dt>{tr("当前套餐")}</dt>
                  <dd>
                    {tr(data.entitlement?.plan_name || data.freePlanName)}
                  </dd>
                </div>
                <div>
                  <dt>{tr("权益到期时间")}</dt>
                  <dd>
                    {data.entitlement
                      ? formatDateTime(data.entitlement.paid_until, locale)
                      : tr("不适用")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("注册时间")}</dt>
                  <dd>{formatDateTime(data.user.created_at, locale)}</dd>
                </div>
              </dl>
              <div
                className="user-record-tabs"
                role="group"
                aria-label={tr("用户相关记录")}
              >
                {Object.entries({
                  tasks: tr("任务列表"),
                  ledger: tr("积分流水"),
                  orders: tr("订单记录"),
                  subscriptions: tr("订阅记录"),
                  redemptions: tr("兑换记录"),
                }).map(([key, label]) => (
                  <Button
                    key={key}
                    variant={section === key ? "primary" : "ghost"}
                    aria-pressed={section === key}
                    onClick={() => onSectionChange(key as UserRecordSection)}
                  >
                    {tr(label)}
                  </Button>
                ))}
              </div>
              <UserRecords
                key={`${section}:${version}`}
                userId={userId}
                section={section}
              />
            </>
          )
        )}
      </div>
    </section>
  );
}
