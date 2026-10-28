import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { useResource } from "@/lib/use-resource";
import { Loading, Notice, Empty } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/date";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Plus, Trash2, Edit } from "lucide-react";
import type { AnnouncementItem } from "../types";

export function AdminAnnouncements() {
  const { t: tr, locale } = useI18n();
  const { data, loading, error, reload } = useResource<{
    announcements: AnnouncementItem[];
  }>("/api/app/admin/announcements", true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"info" | "promotion" | "warning">("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [dismissible, setDismissible] = useState(true);

  function openCreate() {
    setEditingItem(null);
    setTitle("");
    setContent("");
    setType("info");
    setLinkUrl("");
    setLinkText("");
    setIsActive(true);
    setDismissible(true);
    setSubmitError("");
    setModalOpen(true);
  }

  function openEdit(item: AnnouncementItem) {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content);
    setType(item.type);
    setLinkUrl(item.link_url || "");
    setLinkText(item.link_text || "");
    setIsActive(Boolean(item.is_active));
    setDismissible(Boolean(item.dismissible));
    setSubmitError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSubmitError(tr("请输入公告标题"));
      return;
    }
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setSubmitError(tr("请输入公告内容"));
      return;
    }

    setBusy(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/app/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem?.id,
          title: trimmedTitle,
          content: trimmedContent,
          type,
          linkUrl: linkUrl.trim(),
          linkText: linkText.trim(),
          isActive,
          dismissible,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(json.message || "保存失败");
      }
      setModalOpen(false);
      void reload();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await fetch("/api/app/admin/announcements/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !current }),
      });
      void reload();
    } catch {}
  }

  async function handleDelete(id: string) {
    if (!confirm(tr("确定删除此条公告吗？"))) return;
    try {
      await fetch(`/api/app/admin/announcements/${id}`, { method: "DELETE" });
      void reload();
    } catch {}
  }

  const typeLabels = {
    info: tr("普通公告"),
    promotion: tr("活动推广"),
    warning: tr("重要提醒"),
  };

  return (
    <>
      <PageHeading
        title={tr("全站公告")}
        description={tr("发布和管理展示在全站顶部的横幅公告、促销通知与更新提示。")}
        action={
          <Button variant="primary" onClick={openCreate}>
            <Plus size={16} />
            {tr("新建公告")}
          </Button>
        }
      />

      {error && <Notice kind="error">{tr(error)}</Notice>}
      {loading ? (
        <Loading />
      ) : data?.announcements?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("标题与内容")}</th>
                <th>{tr("类型")}</th>
                <th>{tr("跳转链接")}</th>
                <th>{tr("状态")}</th>
                <th>{tr("发布时间")}</th>
                <th>{tr("操作")}</th>
              </tr>
            </thead>
            <tbody>
              {data.announcements.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small className="admin-secondary" style={{ display: "block" }}>
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
                        background:
                          item.type === "promotion"
                            ? "rgba(249, 115, 22, 0.2)"
                            : item.type === "warning"
                              ? "rgba(234, 179, 8, 0.2)"
                              : "rgba(59, 130, 246, 0.2)",
                        color:
                          item.type === "promotion"
                            ? "#fdba74"
                            : item.type === "warning"
                              ? "#fde047"
                              : "#93c5fd",
                      }}
                    >
                      {typeLabels[item.type] || item.type}
                    </span>
                  </td>
                  <td>
                    {item.link_url ? (
                      <a href={item.link_url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                        {item.link_text || item.link_url}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id, Boolean(item.is_active))}
                      style={{
                        background: item.is_active ? "rgba(16, 185, 129, 0.2)" : "rgba(107, 114, 128, 0.2)",
                        color: item.is_active ? "#34d399" : "#9ca3af",
                        border: "none",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                    >
                      {item.is_active ? tr("展示中 (点击停用)") : tr("已停用 (点击展示)")}
                    </button>
                  </td>
                  <td>{formatDateTime(item.created_at, locale)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button variant="secondary" size="small" onClick={() => openEdit(item)}>
                        <Edit size={14} />
                        {tr("编辑")}
                      </Button>
                      <Button variant="danger" size="small" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={tr("暂无全站公告")}>
          {tr("点击右上角「新建公告」发布第一条全站通知或活动横幅。")}
        </Empty>
      )}

      {/* Modal Dialog */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        busy={busy}
        title={editingItem ? tr("编辑公告") : tr("新建全站公告")}
        description={tr("发布和管理展示在全站顶部的横幅公告、促销通知与更新提示。")}
      >
        {submitError && <Notice kind="error">{tr(submitError)}</Notice>}

        <form
          noValidate
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: "16px" }}
        >
          <Field id="announcement-title" label={tr("公告标题")}>
            <Input
              id="announcement-title"
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr("如：全新 FLUX 图像生成已上线！")}
            />
          </Field>

          <Field id="announcement-content" label={tr("公告内容")}>
            <Textarea
              id="announcement-content"
              required
              rows={3}
              maxLength={500}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={tr("简要描述公告或活动详情...")}
            />
          </Field>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <Field id="announcement-type" label={tr("公告类型")}>
              <Select
                id="announcement-type"
                value={type}
                onValueChange={(val) => setType(val as any)}
              >
                <option value="info">{tr("普通公告 (蓝)")}</option>
                <option value="promotion">{tr("活动推广 (橙)")}</option>
                <option value="warning">{tr("重要提醒 (黄)")}</option>
              </Select>
            </Field>

            <Field id="announcement-link-text" label={tr("链接文案")}>
              <Input
                id="announcement-link-text"
                type="text"
                maxLength={50}
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder={tr("如：立即体验 →")}
              />
            </Field>
          </div>

          <Field id="announcement-link-url" label={tr("跳转链接 (选填)")}>
            <Input
              id="announcement-link-url"
              type="text"
              maxLength={500}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={tr("站内路径如 /pricing 或外部链接")}
            />
          </Field>

          <div
            style={{
              display: "flex",
              gap: "24px",
              padding: "12px 14px",
              background: "var(--surface)",
              borderRadius: "8px",
              border: "1px solid var(--line)",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>{tr("立即生效展示")}</span>
            </label>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              <input
                type="checkbox"
                checked={dismissible}
                onChange={(e) => setDismissible(e.target.checked)}
              />
              <span>{tr("允许用户手动关闭")}</span>
            </label>
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              {tr("取消")}
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? tr("保存中...") : tr("保存公告")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
