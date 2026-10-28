import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { useResource } from "@/lib/use-resource";
import { Loading, Notice, Empty } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/date";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { X, CheckCircle, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  feedbackStatuses,
  feedbackTypes,
  type FeedbackItem,
} from "@/modules/feedback/types";

export function AdminFeedbacks() {
  const { t: tr, locale } = useI18n();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [newStatus, setNewStatus] = useState("pending");
  const [adminNotes, setAdminNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const { data, loading, error, reload } = useResource<{
    items: FeedbackItem[];
    nextCursor: string | null;
  }>(`/api/app/admin/feedbacks?status=${statusFilter}`, true);

  function openDetail(item: FeedbackItem) {
    setSelectedFeedback(item);
    setNewStatus(item.status);
    setAdminNotes(item.admin_notes || "");
    setUpdateError("");
  }

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFeedback) return;
    setBusy(true);
    setUpdateError("");
    try {
      const res = await fetch("/api/app/admin/feedbacks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedFeedback.id,
          status: newStatus,
          adminNotes,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(json.message || "更新失败");
      }
      setSelectedFeedback(null);
      void reload();
    } catch (err) {
      setUpdateError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const statusBadges: Record<string, { bg: string; color: string }> = {
    pending: { bg: "rgba(234, 179, 8, 0.2)", color: "#fde047" },
    in_progress: { bg: "rgba(59, 130, 246, 0.2)", color: "#93c5fd" },
    resolved: { bg: "rgba(16, 185, 129, 0.2)", color: "#34d399" },
    closed: { bg: "rgba(107, 114, 128, 0.2)", color: "#9ca3af" },
  };

  return (
    <>
      <PageHeading
        title={tr("用户反馈")}
        description={tr("收集并处理用户提交的功能建议、Bug 缺陷与商务咨询。")}
        action={
          <div className="admin-filter-actions">
            <Select
              className="input"
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <option value="all">{tr("全部状态")}</option>
              <option value="pending">{tr("待处理")}</option>
              <option value="in_progress">{tr("跟进中")}</option>
              <option value="resolved">{tr("已解决")}</option>
              <option value="closed">{tr("已关闭")}</option>
            </Select>
            <Button variant="secondary" onClick={() => void reload()} disabled={loading}>
              {tr("刷新")}
            </Button>
          </div>
        }
      />

      {error && <Notice kind="error">{tr(error)}</Notice>}

      {loading ? (
        <Loading />
      ) : data?.items?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("用户 / 联系方式")}</th>
                <th>{tr("类型")}</th>
                <th>{tr("标题与内容")}</th>
                <th>{tr("状态")}</th>
                <th>{tr("提交时间")}</th>
                <th>{tr("操作")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const badge = statusBadges[item.status] || statusBadges.pending;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.user_email}</strong>
                      {item.contact && item.contact !== item.user_email && (
                        <small className="admin-secondary" style={{ display: "block" }}>
                          {item.contact}
                        </small>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          background: "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        {feedbackTypes[item.type] || item.type}
                      </span>
                    </td>
                    <td>
                      <strong style={{ display: "block" }}>{item.title}</strong>
                      <small className="admin-secondary" style={{ display: "block", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.content}
                      </small>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {feedbackStatuses[item.status] || item.status}
                      </span>
                    </td>
                    <td>{formatDateTime(item.created_at, locale)}</td>
                    <td>
                      <Button variant="secondary" size="small" onClick={() => openDetail(item)}>
                        {tr("查看详情")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={tr("暂无匹配的用户反馈")}>
          {tr("用户在前台提交反馈或工单后，这里会展示待办列表。")}
        </Empty>
      )}

      {/* Detail & Status Modal */}
      <Modal
        open={Boolean(selectedFeedback)}
        onClose={() => setSelectedFeedback(null)}
        busy={busy}
        title={tr("反馈详情")}
        description={tr("收集并处理用户提交的功能建议、Bug 缺陷与商务咨询。")}
      >
        {selectedFeedback && (
          <>
            {updateError && <Notice kind="error">{tr(updateError)}</Notice>}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.875rem", color: "var(--color-primary, #6366f1)", fontWeight: 600 }}>
                    [{feedbackTypes[selectedFeedback.type] || selectedFeedback.type}]
                  </span>
                  <span className="admin-secondary" style={{ fontSize: "0.75rem" }}>
                    {formatDateTime(selectedFeedback.created_at, locale)}
                  </span>
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.05rem" }}>{selectedFeedback.title}</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "0.875rem" }}>
                  {selectedFeedback.content}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="admin-secondary" style={{ fontSize: "0.75rem" }}>{tr("提交用户")}</span>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>{selectedFeedback.user_email}</p>
                </div>
                <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="admin-secondary" style={{ fontSize: "0.75rem" }}>{tr("联系方式")}</span>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>{selectedFeedback.contact || "-"}</p>
                </div>
              </div>

              <form onSubmit={handleStatusUpdate} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "4px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
                    {tr("处理状态")}
                  </label>
                  <Select
                    className="full-width"
                    value={newStatus}
                    onValueChange={setNewStatus}
                  >
                    <option value="pending">{tr("待处理")}</option>
                    <option value="in_progress">{tr("跟进中")}</option>
                    <option value="resolved">{tr("已解决")}</option>
                    <option value="closed">{tr("已关闭")}</option>
                  </Select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "0.875rem", fontWeight: 500 }}>
                    {tr("内部跟进备注 (仅管理员可见)")}
                  </label>
                  <textarea
                    rows={3}
                    className="input full-width"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={tr("记录处理进展、客诉排查结果或已答复信息...")}
                  />
                </div>

                <div className="modal-actions">
                  <Button type="button" variant="secondary" onClick={() => setSelectedFeedback(null)}>
                    {tr("取消")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={busy}>
                    {busy ? tr("更新中...") : tr("保存跟进记录")}
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
