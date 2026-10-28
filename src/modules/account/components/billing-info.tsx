import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Loading, Notice } from "@/components/ui/feedback";
import { RedeemCode } from "./redeem";
import { AccountSummary } from "./account-summary";
import {
  BillingRecords,
  billingSections,
  type BillingSection,
} from "./billing-records";
import type { AccountBilling, BillingRecordPage } from "../types";
export function BillingInfo({
  section,
  onSection,
}: {
  section: BillingSection;
  onSection: (section: BillingSection) => void;
}) {
  const { t: tr, locale } = useI18n();
  const { data, error, loading, reload } = useResource<AccountBilling>(
    "/api/app/billing/summary",
    true,
  );
  const [pages, setPages] = useState<Record<BillingSection, string[]>>({
    subscriptions: [""],
    orders: [""],
    redemptions: [""],
  });
  const cursors = pages[section];
  const records = useResource<BillingRecordPage>(
    "/api/app/billing/records?" +
      new URLSearchParams({
        section,
        cursor: cursors.at(-1) || "",
      }),
    true,
  );
  const refresh = async () => {
    await Promise.all([reload(), records.reload()]);
  };
  const firstPage = () =>
    setPages({
      subscriptions: [""],
      orders: [""],
      redemptions: [""],
    });
  const [busy, setBusy] = useState("");
  const [issue, setIssue] = useState("");
  const [message, setMessage] = useState("");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [cancelId, setCancelId] = useState("");
  async function cancel() {
    setBusy(cancelId);
    setIssue("");
    setMessage("");
    try {
      await api("/api/app/cancel-subscription", {
        method: "POST",
        body: JSON.stringify({
          id: cancelId,
        }),
      });
      setMessage("已提交取消续费，状态以支付渠道确认结果为准。");
      setCancelId("");
      await refresh();
    } catch (e) {
      setIssue(e instanceof Error ? e.message : "取消失败，请重试。");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="account-page">
      <PageHeading
        title={tr("会员与积分")}
        description={tr("管理套餐续费，查看购买和兑换记录。")}
        action={
          <div className="account-heading-actions">
            <Button variant="secondary" onClick={() => setRedeemOpen(true)}>
              <Gift size={16} />
              {tr("兑换权益")}
            </Button>
            <Link to="/pricing" className="button button-primary">
              {tr("购买套餐")}
            </Link>
          </div>
        }
      />
      {error && (
        <>
          <Notice kind="error">{tr(error)}</Notice>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {tr("重新加载")}
          </Button>
        </>
      )}
      {issue && !cancelId && <Notice kind="error">{tr(issue)}</Notice>}
      {message && <Notice>{tr(message)}</Notice>}
      {loading && !data ? (
        <Loading />
      ) : (
        data &&
        !error && (
          <>
            <AccountSummary data={data} />
            <section
              className="account-records-section"
              aria-label={tr("套餐相关记录")}
            >
              <div className="account-record-toolbar">
                <div
                  className="admin-tabs"
                  role="group"
                  aria-label={tr("记录类型")}
                >
                  {(
                    Object.entries(billingSections) as [
                      BillingSection,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      variant="ghost"
                      aria-pressed={section === key}
                      onClick={() => onSection(key)}
                    >
                      {tr(label)}
                    </Button>
                  ))}
                  <Link
                    to="/billing"
                    className="button button-ghost"
                    style={{ textDecoration: "none" }}
                  >
                    {tr("积分明细")}
                  </Link>
                </div>
                <div className="account-heading-actions">
                  <Button
                    variant="secondary"
                    disabled={!!busy || loading || records.loading}
                    onClick={() => void refresh()}
                  >
                    {tr("刷新")}
                  </Button>
                </div>
              </div>
              {records.error && (
                <Notice kind="error">{tr(records.error)}</Notice>
              )}
              {records.loading ? (
                <Loading />
              ) : (
                records.data &&
                !records.error && (
                  <BillingRecords
                    data={records.data}
                    section={section}
                    busy={!!busy}
                    onCancel={(id) => {
                      setIssue("");
                      setCancelId(id);
                    }}
                  />
                )
              )}
              <nav className="admin-pagination" aria-label={tr("套餐记录分页")}>
                <span>{tr("第 {0} 页 · 每页 25 条", [cursors.length])}</span>
                <Button
                  variant="secondary"
                  disabled={records.loading || cursors.length === 1}
                  onClick={() =>
                    setPages((p) => ({
                      ...p,
                      [section]: cursors.slice(0, -1),
                    }))
                  }
                >
                  {tr("上一页")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    records.loading ||
                    !!records.error ||
                    !records.data?.nextCursor
                  }
                  onClick={() => {
                    if (records.data?.nextCursor)
                      setPages((p) => ({
                        ...p,
                        [section]: [...cursors, records.data!.nextCursor!],
                      }));
                  }}
                >
                  {tr("下一页")}
                </Button>
              </nav>
            </section>
          </>
        )
      )}
      {redeemOpen && (
        <Modal
          open
          onClose={() => setRedeemOpen(false)}
          title={tr("兑换权益")}
          description={tr(
            "输入兑换码，领取积分或套餐权益。每个兑换码仅可使用一次。",
          )}
          busy={redeemBusy}
        >
          <RedeemCode
            onBusyChange={setRedeemBusy}
            onRedeem={async () => {
              firstPage();
              await refresh();
              onSection("redemptions");
            }}
          />
        </Modal>
      )}
      <Modal
        open={!!cancelId}
        onClose={() => {
          setCancelId("");
          setIssue("");
        }}
        title={tr("取消后续续费")}
        description={tr("取消后不再自动续费，已支付的套餐权益保留到期。")}
        busy={!!busy}
      >
        <p>
          {
            records.data?.subscriptions.find((s) => s.id === cancelId)
              ?.plan_name
          }
        </p>
        {issue && <Notice kind="error">{tr(issue)}</Notice>}
        <div className="account-heading-actions">
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={() => setCancelId("")}
          >
            {tr("保留订阅")}
          </Button>
          <Button disabled={!!busy} onClick={() => void cancel()}>
            {busy ? tr("正在提交…") : tr("确认取消续费")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
