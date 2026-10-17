import { useI18n } from "@/i18n/react";
import {
  RedemptionRecordCells,
  redemptionHeadings,
} from "./redemption-record-cells";
import { TableEmptyRow } from "./table-empty-row";
import { Modal } from "@/components/ui/modal";
import { Plus } from "lucide-react";
import { CompactValue } from "@/components/ui/compact-value";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { AdminList, DateTime } from "./list";
import { MutationButton } from "./mutation";
import type { AdminCode, AdminRedemption } from "../types";
import { supportsAnnual, type Plan } from "@/modules/billing/plans";
export function AdminCodes() {
  const { t: tr, locale } = useI18n();
  const q = useRouterState({
    select: (state) =>
      (
        state.location.search as {
          q?: string;
        }
      ).q,
  });
  const [view, setView] = useState(q ? "redemptions" : "codes"),
    [version, setVersion] = useState(0),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [created, setCreated] = useState<{
      code: string;
      credits: number;
      termMonths: number;
      grantMonths: number;
      planName: string | null;
    } | null>(null);
  return (
    <>
      <PageHeading
        title={tr("兑换码")}
        description={tr("创建积分或套餐兑换码；每码仅限一名用户兑换一次。")}
        action={
          <Button
            onClick={() => {
              setCreated(null);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            {tr("创建兑换码")}
          </Button>
        }
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title={created ? tr("兑换码已创建") : tr("创建兑换码")}
        description={
          created
            ? tr("复制后可发给用户，后续也可在列表中复制。")
            : tr("设置兑换内容和有效期，每码只能兑换一次。")
        }
      >
        {created ? (
          <div className="code-created">
            <code className="admin-code-value">{created.code}</code>
            <CompactValue value={created.code} label={tr("兑换码")} copyOnly />
            <p>
              {created.planName || tr("积分")} · {created.credits}{" "}
              {created.grantMonths === 12
                ? tr("积分/月，共 12 期，一年权益")
                : tr("积分")}
              {created.termMonths === 1 ? tr(" · 一个月套餐权益") : ""}
            </p>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tr("完成")}
            </Button>
          </div>
        ) : (
          open && (
            <CodeForm
              onBusyChange={setBusy}
              onCancel={() => setOpen(false)}
              onCreated={(r) => {
                setCreated(r);
                setVersion((v) => v + 1);
              }}
            />
          )
        )}
      </Modal>
      <div className="admin-tabs">
        <Button
          variant={view === "codes" ? "primary" : "secondary"}
          aria-pressed={view === "codes"}
          onClick={() => setView("codes")}
        >
          {tr("兑换码管理")}
        </Button>
        <Button
          variant={view === "redemptions" ? "primary" : "secondary"}
          aria-pressed={view === "redemptions"}
          onClick={() => setView("redemptions")}
        >
          {tr("兑换记录")}
        </Button>
      </div>
      {view === "codes" ? (
        <AdminList<AdminCode>
          key={version + "codes"}
          endpoint="codes"
          statuses={{
            available: tr("可兑换"),
            disabled: tr("已停用"),
            expired: tr("已过期"),
            exhausted: tr("已兑换"),
          }}
          searchHint={tr("按完整名称或兑换码查询；每码仅限一名用户兑换一次。")}
          searchPlaceholder={tr("输入名称或兑换码")}
        >
          {(rows, reload) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr("名称")}</th>
                    <th>{tr("兑换码")}</th>
                    <th>{tr("兑换内容")}</th>
                    <th>{tr("有效期")}</th>
                    <th>{tr("状态")}</th>
                    <th>{tr("操作")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!rows.length && <TableEmptyRow columns={6} />}
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="table-reason" title={c.name}>
                          {c.name}
                        </span>
                      </td>
                      <td>
                        {c.code ? (
                          <>
                            <code className="redemption-token">{c.code}</code>
                            <CompactValue
                              value={c.code}
                              label={tr("兑换码")}
                              copyOnly
                            />
                          </>
                        ) : (
                          <span className="admin-secondary">
                            {c.code_status === "legacy"
                              ? tr("旧码未保存原文")
                              : tr("暂时无法读取，请检查加密配置")}
                            {c.code_status === "legacy" && (
                              <small className="admin-secondary">
                                {c.hint}
                              </small>
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        {tr(c.plan_name || tr("积分"))} · {c.credits}{" "}
                        {c.grant_months === 12
                          ? tr("积分/月，共 12 期")
                          : tr("积分")}
                        {c.term_months > 0 ? (
                          <small className="admin-secondary">
                            {tr("{0} 站内权益，不自动续费", [
                              c.term_months === 12 ? "一年" : "一个月",
                            ])}
                          </small>
                        ) : (
                          c.days > 0 && (
                            <small className="admin-secondary">
                              {tr("{0} 天站内权益，不自动续费", [c.days])}
                            </small>
                          )
                        )}
                      </td>
                      <td>
                        <DateTime value={c.expires_at} />
                      </td>
                      <td>
                        {c.used > 0
                          ? tr("已兑换")
                          : c.disabled_at !== null
                            ? tr("已停用")
                            : c.expires_at <= Date.now()
                              ? tr("已过期")
                              : tr("可兑换")}
                      </td>
                      <td>
                        {c.used > 0 ? (
                          "—"
                        ) : (
                          <MutationButton
                            path="/api/app/admin/code-status"
                            payload={{
                              id: c.id,
                              disabled: c.disabled_at === null,
                            }}
                            label={
                              c.disabled_at === null ? tr("停用") : tr("启用")
                            }
                            onDone={reload}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminList>
      ) : (
        <AdminList<AdminRedemption>
          endpoint="redemptions"
          searchPlaceholder={tr("输入完整邮箱或兑换码")}
          statuses={{}}
          searchHint={tr("支持完整邮箱或完整兑换码查询。")}
        >
          {(rows) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {redemptionHeadings.map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!rows.length && <TableEmptyRow columns={5} />}
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <RedemptionRecordCells record={r} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminList>
      )}
    </>
  );
}
function CodeForm({
  onCreated,
  onCancel,
  onBusyChange,
}: {
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onCreated: (r: {
    code: string;
    credits: number;
    termMonths: number;
    grantMonths: number;
    planName: string | null;
  }) => void;
}) {
  const { t: tr, locale } = useI18n();
  const { data, error: planError } = useResource<{
    plans: Plan[];
  }>("/api/app/admin/plans");
  const [name, setName] = useState(""),
    [kind, setKind] = useState("credits"),
    [credits, setCredits] = useState(100),
    [planId, setPlanId] = useState("creator"),
    [interval, setInterval] = useState<"month" | "year">("month"),
    [validDays, setValidDays] = useState(30),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selectedPlan = data?.plans.find((p) => p.id === planId);
  const selectedInterval =
    selectedPlan && supportsAnnual(selectedPlan) ? interval : "month";
  const [requestId] = useState(() => crypto.randomUUID());
  return (
    <form
      className="code-create-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        onBusyChange(true);
        setError("");
        try {
          const r = await api<{
            code: string;
            credits: number;
            termMonths: number;
            grantMonths: number;
            planName: string | null;
          }>("/api/app/admin/codes", {
            method: "POST",
            body: JSON.stringify({
              requestId,
              name,
              kind,
              credits,
              planId,
              ...(kind === "plan" && selectedPlan?.mode === "subscription"
                ? {
                    interval: selectedInterval,
                  }
                : {}),
              expiresAt: Date.now() + validDays * 86400000,
            }),
          });
          onCreated(r);
        } catch (e) {
          setError(e instanceof Error ? e.message : "创建失败");
        } finally {
          setBusy(false);
          onBusyChange(false);
        }
      }}
    >
      <Field id="code-name" label={tr("名称")}>
        <Input
          id="code-name"
          value={name}
          maxLength={80}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field id="code-kind" label={tr("兑换类型")}>
        <Select
          className="input"
          id="code-kind"
          value={kind}
          onValueChange={(value) => setKind(value)}
        >
          <option value="credits">{tr("积分")}</option>
          <option value="plan">{tr("套餐")}</option>
        </Select>
      </Field>
      {kind === "credits" ? (
        <Field id="code-credits" label={tr("奖励积分")}>
          <Input
            id="code-credits"
            type="number"
            min={1}
            max={1000000}
            value={credits}
            required
            onChange={(e) => setCredits(Number(e.target.value))}
          />
        </Field>
      ) : (
        <>
          <Field id="code-plan" label={tr("套餐")}>
            <Select
              className="input"
              id="code-plan"
              value={planId}
              onValueChange={(value) => setPlanId(value)}
            >
              {data?.plans
                .filter((p) => p.mode !== "free" && p.enabled)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.credits}{" "}
                    {p.mode === "subscription" ? tr("积分/月") : tr("积分")}
                  </option>
                ))}
            </Select>
          </Field>
          {selectedPlan?.mode === "subscription" && (
            <Field id="code-interval" label={tr("兑换套餐周期")}>
              <Select
                id="code-interval"
                value={selectedInterval}
                onValueChange={(value) =>
                  setInterval(value as "month" | "year")
                }
              >
                <option value="month">{tr("月付权益 · 一个月")}</option>
                {supportsAnnual(selectedPlan) && (
                  <option value="year">
                    {tr("年付权益 · 每月发放，共 12 期")}
                  </option>
                )}
              </Select>
            </Field>
          )}
          {selectedPlan?.mode === "subscription" &&
            selectedInterval === "year" && (
              <Notice>
                {tr(
                  "兑换后获得一年权益，每月发放一次积分，共 12 期。已有同套餐权益时，从原到期时间开始顺延；不自动续费。",
                )}
              </Notice>
            )}
          {selectedPlan?.mode === "subscription" &&
            selectedInterval === "month" && (
              <Notice>
                {tr(
                  "兑换后获得一个月权益，发放当月积分。已有同套餐权益时，从原到期时间顺延一个月；不自动续费。",
                )}
              </Notice>
            )}
        </>
      )}
      <div>
        <Field id="code-valid" label={tr("兑换有效天数")}>
          <Input
            id="code-valid"
            type="number"
            min={1}
            max={365}
            value={validDays}
            required
            onChange={(e) => setValidDays(Number(e.target.value))}
          />
        </Field>
      </div>
      {(error || planError) && (
        <Notice kind="error">{error || planError}</Notice>
      )}
      <div className="modal-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          {tr("取消")}
        </Button>
        <Button
          type="submit"
          disabled={
            busy ||
            (kind === "plan" &&
              !data?.plans.some((p) => p.id === planId && p.enabled))
          }
        >
          {busy ? tr("创建中…") : tr("生成兑换码")}
        </Button>
      </div>
    </form>
  );
}
