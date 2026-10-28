import { useI18n } from "@/i18n/react";
import { CompactValue } from "@/components/ui/compact-value";
import { DateTime, Person } from "./list";
import type { UserRecord } from "../types";
export const redemptionHeadings = [
  "兑换人邮箱",
  "兑换码",
  "兑换内容",
  "权益到期",
  "兑换时间",
];

/** Shared columns for all redemption history views. */
export function RedemptionRecordCells({ record: r }: { record: UserRecord }) {
  const { t: tr, locale } = useI18n();
  return (
    <>
      <td>
        <Person name={r.name || null} email={r.email || null} />
      </td>
      <td>
        {r.code ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <code className="redemption-token">{r.code}</code>
            <CompactValue value={r.code} label={tr("兑换码")} copyOnly />
          </div>
        ) : (
          <>
            <span className="admin-secondary">
              {r.code_status === "legacy"
                ? tr("旧码未保存原文")
                : tr("兑换码暂时无法读取")}
            </span>
            {r.hint && <small className="admin-secondary">{r.hint}</small>}
          </>
        )}
        {r.code_name && (
          <small className="admin-secondary">
            {tr("名称：{0}", [r.code_name])}
          </small>
        )}
      </td>
      <td>
        <span className="table-reason">
          {tr(r.plan_name || tr("积分兑换"))} · {r.credits ?? 0}{" "}
          {r.grant_months === 12 ? tr("积分/月，共 12 期") : tr("积分")}
        </span>
        <CompactValue value={r.id} label={tr("兑换记录编号")} />
      </td>
      <td>{r.expires_at ? <DateTime value={r.expires_at} /> : tr("不适用")}</td>
      <td>
        <DateTime value={r.created_at ?? 0} />
      </td>
    </>
  );
}
