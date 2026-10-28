import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Loading, Notice } from "@/components/ui/feedback";
import {
  type AdminPlan,
  type PaymentBindings,
  formatPrice,
  planTypeLabel,
  annualSavings,
} from "@/modules/billing/plans";
import { Plus, Pencil, RefreshCw } from "lucide-react";
export function AdminPlans() {
  const { t: tr, locale } = useI18n();
  const { data, error, loading, reload } = useResource<{
    plans: AdminPlan[];
    activeProvider?: string;
  }>("/api/app/admin/plans");
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeading
        title={tr("套餐配置")}
        description={tr(
          "每个订阅套餐可配置月付和年付两种价格，共用每月积分与权益；积分包单独管理。",
        )}
        action={
          <div className="admin-filter-actions">
            <Button onClick={() => setEditing("new")}>
              <Plus size={15} />
              {tr("添加套餐")}
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void reload()}
            >
              <RefreshCw size={15} />
              {tr("刷新")}
            </Button>
          </div>
        }
      />
      <p className="admin-secondary">
        {tr(
          "年付价格是全年实付金额，积分按月发放 12 次。保存后前台在下次加载时采用新配置；历史订单和已付费订阅保留原权益。",
        )}
      </p>
      {error && <Notice kind="error">{tr(error)}</Notice>}
      {loading ? (
        <Loading />
      ) : (
        data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("套餐名称")}</th>
                  <th>{tr("类型")}</th>
                  <th>{tr("价格（USD）")}</th>
                  <th>{tr("积分发放")}</th>
                  <th>{tr("支付绑定")}</th>
                  <th>{tr("状态")}</th>
                  <th>{tr("操作")}</th>
                </tr>
              </thead>
              <tbody>
                {data.plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <small className="admin-secondary">
                        {tr(p.description)}
                      </small>
                    </td>
                    <td>
                      {p.mode === "subscription"
                        ? tr("订阅套餐")
                        : planTypeLabel(p)}
                    </td>
                    <td>
                      {formatPrice(p.price, locale)}
                      {p.mode === "subscription" ? tr(" / 月") : ""}
                      {p.annualPrice && (
                        <small className="admin-secondary">
                          {formatPrice(p.annualPrice, locale)}
                          {tr("/ 年")}
                        </small>
                      )}
                    </td>
                    <td>
                      {tr("{0} 积分 {1}", [
                        p.credits,
                        p.mode === "subscription" ? " / 月" : " / 次",
                      ])}
                    </td>
                    <td>
                      {p.mode === "free"
                        ? tr("无需支付")
                        : Object.entries(p.paymentBindings)
                            .filter(([, ref]) => ref)
                            .map(
                              ([provider]) =>
                                ({
                                  pancake: "Waffo Pancake",
                                  stripe: "Stripe",
                                  creem: "Creem",
                                  paypal: "PayPal",
                                })[provider],
                            )
                            .join("、") || tr("未单独配置")}
                    </td>
                    <td>{p.enabled ? tr("已上架") : tr("已下架")}</td>
                    <td>
                      <Button variant="secondary" onClick={() => setEditing(p)}>
                        <Pencil size={14} />
                        {tr("编辑")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        busy={busy}
        title={editing === "new" ? tr("添加套餐") : tr("编辑套餐")}
        description={tr("配置价格、积分、展示内容和支付渠道商品绑定。")}
      >
        {editing && (
          <PlanEditor
            key={editing === "new" ? "new" : editing.id}
            plan={editing === "new" ? null : editing}
            activeProvider={data?.activeProvider || "pancake"}
            onBusy={setBusy}
            onSave={async () => {
              setEditing(null);
              await reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}
function PlanEditor({
  plan,
  activeProvider = "pancake",
  onSave,
  onBusy,
}: {
  plan: AdminPlan | null;
  activeProvider?: string;
  onSave: () => Promise<void>;
  onBusy: (v: boolean) => void;
}) {
  const { t: tr, locale } = useI18n();
  const [form, setForm] = useState<AdminPlan>(
    plan || {
      id: "",
      name: "",
      mode: "subscription",
      interval: "month",
      price: 1900,
      credits: 500,
      description: "",
      features: [],
      enabled: false,
      revision: 1,
      paymentBindings: {},
      annualPrice: null,
      annualPaymentBindings: {},
    },
  );
  const [price, setPrice] = useState(((plan?.price ?? 1900) / 100).toFixed(2));
  const [annualPrice, setAnnualPrice] = useState(
    ((plan?.annualPrice ?? (plan?.price ?? 1900) * 10) / 100).toFixed(2),
  );
  const [features, setFeatures] = useState(plan?.features.join("\n") || "");
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const type =
    form.mode === "subscription" ? form.interval || "month" : form.mode;

  const [selectedChannel, setSelectedChannel] = useState<keyof PaymentBindings>(
    () => {
      if (
        activeProvider &&
        (activeProvider === "pancake" ||
          activeProvider === "stripe" ||
          activeProvider === "creem" ||
          activeProvider === "paypal")
      ) {
        return activeProvider as keyof PaymentBindings;
      }
      return "pancake";
    },
  );

  const channelList: Array<{
    key: keyof PaymentBindings;
    name: string;
    hint: string;
  }> = [
    {
      key: "pancake",
      name: "Waffo Pancake",
      hint: tr("订阅绑定对应月付或年付商品；积分包绑定一次性商品。"),
    },
    {
      key: "stripe",
      name: "Stripe",
      hint: tr(
        "填写 price_ 开头的价格 ID，不是 prod_ 商品 ID；留空可按站内价格动态创建。",
      ),
    },
    {
      key: "creem",
      name: "Creem",
      hint: tr("商品币种、价格和计费周期需与此套餐一致。"),
    },
    {
      key: "paypal",
      name: "PayPal",
      hint: tr("填写 P- 开头的月付或年付计划 ID。"),
    },
  ];

  const availableChannels = channelList.filter(
    (c) => c.key !== "paypal" || form.mode === "subscription",
  );
  const currentChannel =
    availableChannels.find((c) => c.key === selectedChannel) ||
    availableChannels[0];
  return (
    <form
      className="admin-plan"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        onBusy(true);
        setError("");
        try {
          await api(
            plan ? "/api/app/admin/plans" : "/api/app/admin/plans/create",
            {
              method: "POST",
              body: JSON.stringify({
                ...(plan
                  ? {
                      id: plan.id,
                      revision: plan.revision,
                    }
                  : {
                      requestId,
                    }),
                mode: form.mode,
                interval: form.interval,
                name: form.name,
                price: Math.round(Number(price) * 100),
                credits: form.credits,
                description: form.description,
                features: features
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
                enabled: form.enabled,
                paymentBindings: form.paymentBindings,
                annualPrice:
                  form.annualPrice !== null && form.annualPrice !== undefined
                    ? Math.round(Number(annualPrice) * 100)
                    : null,
                annualPaymentBindings: form.annualPrice
                  ? (form.annualPaymentBindings ?? {})
                  : {},
              }),
            },
          );
          await onSave();
        } catch (e) {
          setError(e instanceof Error ? e.message : "保存失败");
        } finally {
          setBusy(false);
          onBusy(false);
        }
      }}
    >
      <Field id="plan-name" label={tr("套餐名称")}>
        <Input
          id="plan-name"
          value={form.name}
          required
          maxLength={40}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
        />
      </Field>
      <Field
        id="plan-type"
        label={tr("套餐类型")}
        hint={
          plan
            ? tr("订阅套餐可在下方启用年付；每月积分和功能由两种计费方式共用。")
            : tr("同一种类型可以创建多个套餐。")
        }
      >
        <Select
          id="plan-type"
          className="input"
          value={type}
          disabled={!!plan}
          onValueChange={(value) =>
            setForm({
              ...form,
              mode: value === "payment" ? "payment" : "subscription",
              interval: value === "payment" ? null : "month",
              paymentBindings: {},
              annualPrice: null,
              annualPaymentBindings: {},
            })
          }
        >
          {form.mode === "free" && (
            <option value="free">{tr("免费体验")}</option>
          )}
          <option value="month">{tr("订阅套餐（月付 / 年付）")}</option>
          <option value="payment">{tr("积分包")}</option>
        </Select>
      </Field>
      <div className="admin-form-columns">
        <Field
          id="plan-price"
          label={type === "month" ? tr("月付价格（USD）") : tr("价格（USD）")}
        >
          <Input
            id="plan-price"
            type="number"
            min={form.mode === "free" ? 0 : 0.01}
            max={100000}
            step="0.01"
            value={price}
            disabled={form.mode === "free"}
            required
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field
          id="plan-credits"
          label={
            form.mode === "subscription"
              ? tr("每月发放积分")
              : form.mode === "free"
                ? tr("注册赠送积分")
                : tr("购买获得积分")
          }
        >
          <Input
            id="plan-credits"
            type="number"
            min={form.mode === "free" ? 0 : 1}
            max={1000000}
            value={form.credits}
            required
            onChange={(e) =>
              setForm({
                ...form,
                credits: Number(e.target.value),
              })
            }
          />
        </Field>
      </div>
      {type === "month" && (
        <fieldset>
          <legend>{tr("年付选项")}</legend>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={!!form.annualPrice}
              onChange={(e) =>
                setForm({
                  ...form,
                  annualPrice: e.target.checked
                    ? Math.round(Number(annualPrice) * 100) || 1
                    : null,
                  annualPaymentBindings: e.target.checked
                    ? form.annualPaymentBindings
                    : {},
                })
              }
            />
            {tr("允许此套餐按年付费")}
          </label>
          {!!form.annualPrice && (
            <>
              <Field
                id="plan-annual-price"
                label={tr("年付全年实付价格（USD）")}
                hint={tr("填写全年总价；前台自动计算折合月价和节省金额。")}
              >
                <Input
                  id="plan-annual-price"
                  type="number"
                  min={0.01}
                  max={Math.min(100000, Number(price) * 12)}
                  step="0.01"
                  value={annualPrice}
                  required
                  onChange={(e) => setAnnualPrice(e.target.value)}
                />
              </Field>
              <p className="admin-secondary">
                {tr("每月")}
                {form.credits}
                {tr("积分，共 12 期；与月付共享权益。")}
                {(() => {
                  const saving = annualSavings({
                    ...form,
                    price: Math.round(Number(price) * 100),
                    annualPrice: Math.round(Number(annualPrice) * 100),
                  });
                  return saving
                    ? `比逐月支付一年节省 ${formatPrice(saving.amount, locale)}。`
                    : "";
                })()}
              </p>
            </>
          )}
        </fieldset>
      )}
      <Field id="plan-description" label={tr("简短说明")}>
        <Input
          id="plan-description"
          value={form.description}
          maxLength={160}
          onChange={(e) =>
            setForm({
              ...form,
              description: e.target.value,
            })
          }
        />
      </Field>
      <Field
        id="plan-features"
        label={tr("权益说明")}
        hint={tr("每行一条，最多 8 条。")}
      >
        <Textarea
          id="plan-features"
          rows={3}
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
        />
      </Field>
      {form.mode !== "free" && (
        <fieldset>
          <legend>{tr("支付商品绑定")}</legend>
          <p className="admin-secondary">
            {tr(
              "填写当前环境的商品 ID；API 密钥仍只在服务端环境配置中保存。支付前会回查商品；请先在支付平台创建对应商品。",
            )}
          </p>

          <div className="plan-channel-field-group">
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: "6px",
              }}
            >
              {tr("选择支付渠道：")}
            </label>
            <div
              className="plan-channel-tabs"
              role="tablist"
              aria-label={tr("选择支付渠道：")}
            >
              {availableChannels.map((c) => {
                const isSelected = currentChannel.key === c.key;
                const isActive = activeProvider === c.key;
                const hasBase = Boolean(form.paymentBindings[c.key]);
                const hasAnnual = Boolean(form.annualPaymentBindings?.[c.key]);
                const isBound = hasBase || hasAnnual;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`plan-channel-tab-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedChannel(c.key)}
                  >
                    <span>{c.name}</span>
                    {isActive && (
                      <span className="plan-channel-active-tag">
                        {tr("当前启用")}
                      </span>
                    )}
                    {isBound && (
                      <span
                        className="plan-channel-bound-tag"
                        title={tr("已绑定")}
                      >
                        {tr("已绑定")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="plan-channel-card">
              <div className="plan-channel-header">
                <h4>
                  <span>{currentChannel.name}</span>
                  {activeProvider === currentChannel.key ? (
                    <span className="active-badge">
                      {tr("系统当前结算渠道")}
                    </span>
                  ) : (
                    <span className="optional-badge">
                      {tr("备用渠道 (选填)")}
                    </span>
                  )}
                </h4>
                <small className="admin-secondary" style={{ margin: 0 }}>
                  {activeProvider === currentChannel.key
                    ? tr("当前系统默认使用此渠道进行收银，建议配置此渠道的商品 ID。")
                    : tr("未切换至此渠道时可留空。若后续环境变量切换为此提供商，将自动采用此处配置。")}
                </small>
              </div>

              {form.mode === "payment" && currentChannel.key === "paypal" ? (
                <p className="admin-secondary" style={{ margin: "4px 0" }}>
                  {tr("PayPal 积分包直接创建一次性付款订单，无需 Plan ID。")}
                </p>
              ) : (
                <>
                  <Field
                    id={`binding-base-${currentChannel.key}`}
                    label={
                      type === "month"
                        ? tr("月付商品 ID")
                        : tr("一次性商品 ID")
                    }
                    hint={currentChannel.hint}
                  >
                    <Input
                      id={`binding-base-${currentChannel.key}`}
                      value={form.paymentBindings[currentChannel.key] || ""}
                      maxLength={200}
                      placeholder={
                        currentChannel.key === "stripe"
                          ? "price_..."
                          : currentChannel.key === "paypal"
                            ? "P-..."
                            : "prod_..."
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          paymentBindings: {
                            ...form.paymentBindings,
                            [currentChannel.key]: e.target.value.trim(),
                          },
                        })
                      }
                    />
                  </Field>

                  {Boolean(form.annualPrice) && (
                    <Field
                      id={`binding-year-${currentChannel.key}`}
                      label={tr("年付商品 ID")}
                      hint={currentChannel.hint}
                    >
                      <Input
                        id={`binding-year-${currentChannel.key}`}
                        value={
                          form.annualPaymentBindings?.[currentChannel.key] || ""
                        }
                        maxLength={200}
                        placeholder={
                          currentChannel.key === "stripe"
                            ? "price_..."
                            : currentChannel.key === "paypal"
                              ? "P-..."
                              : "prod_..."
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            annualPaymentBindings: {
                              ...(form.annualPaymentBindings ?? {}),
                              [currentChannel.key]: e.target.value.trim(),
                            },
                          })
                        }
                      />
                    </Field>
                  )}
                </>
              )}
            </div>
          </div>
        </fieldset>
      )}
      <label className="admin-toggle">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) =>
            setForm({
              ...form,
              enabled: e.target.checked,
            })
          }
        />
        {tr("上架套餐")}
        {form.mode === "free" ? tr("并启用注册赠送") : tr("，在前台展示")}
      </label>
      {error && <Notice kind="error">{tr(error)}</Notice>}
      <Button type="submit" disabled={busy}>
        {busy ? tr("保存中…") : plan ? tr("保存套餐") : tr("添加套餐")}
      </Button>
    </form>
  );
}
