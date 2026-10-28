import { useI18n } from "@/i18n/react";
import { formatDateTime } from "@/lib/date";
import { taskErrors, taskStatuses, labelFor } from "@/modules/admin/types";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getTool } from "@/modules/tools/catalog";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import type { Generation } from "@/modules/tools/types";
import { PageHeading } from "@/components/layout/page-heading";
import { Loading, Notice, Empty } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm-dialog";
import {
  Download,
  Copy,
  Check,
  Eye,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
  Play,
} from "lucide-react";

type PageData = {
  history: Generation[];
  nextCursor: string | null;
};

function getModality(g: Generation): "image" | "video" | "audio" | "text" {
  const tool = getTool(g.tool_id);
  if (tool && "modality" in tool && tool.modality) {
    return tool.modality as "image" | "video" | "audio";
  }
  if (g.tool_id === "image") return "image";
  if (g.tool_id === "video") return "video";
  if (g.tool_id === "audio") return "audio";
  const out = g.output || "";
  if (/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(out) || out.startsWith("data:image/")) return "image";
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(out) || out.startsWith("data:video/")) return "video";
  if (/\.(mp3|ogg|wav)(\?.*)?$/i.test(out) || out.startsWith("data:audio/")) return "audio";
  return "text";
}

export function TaskList() {
  const { t: tr, locale } = useI18n();
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [cursors, setCursors] = useState<string[]>([""]);
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");

  const params = new URLSearchParams({
    status,
    cursor: cursors.at(-1) || "",
  });

  const { data, loading, error, reload } = useResource<PageData>(
    "/api/app/history?" + params,
    true,
  );

  const selected = data?.history.find((g) => g.id === selectedId);
  const selectedModality = selected ? getModality(selected) : "text";

  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success(tr("已复制到剪贴板"));
      setTimeout(() => {
        setCopied((prev) => (prev === id ? "" : prev));
      }, 2000);
    } catch {
      setIssue(tr("复制失败，请手动选择内容复制。"));
      toast.error(tr("复制失败，请手动选择内容复制。"));
    }
  }

  async function downloadItem(g: Generation) {
    if (!g.output) return;
    const modality = getModality(g);
    const ext =
      modality === "image"
        ? "png"
        : modality === "video"
          ? "mp4"
          : modality === "audio"
            ? "mp3"
            : "txt";
    const filename = `${g.tool_id || "ai"}-${g.id.slice(0, 8)}.${ext}`;

    if (modality === "text") {
      const blob = new Blob([g.output], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const res = await fetch(g.output, { mode: "cors" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement("a");
      a.href = g.output;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({
      title: tr("删除记录确认"),
      description: tr("删除这条创作记录？删除后无法恢复，积分流水会保留。"),
      confirmText: tr("确认删除"),
      variant: "danger",
    });
    if (!ok) return;
    setBusy(id);
    setIssue("");
    try {
      await api("/api/app/history/" + id, { method: "DELETE" });
      setSelectedId("");
      toast.success(tr("已删除创作记录"));
      if (data?.history.length === 1 && cursors.length > 1) {
        setCursors((c) => c.slice(0, -1));
      } else {
        await reload();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      setIssue(msg);
      toast.error(msg);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="account-page">
      <PageHeading
        title={tr("生成历史")}
        description={tr("查看与管理你历史生成的 AI 内容与作品。")}
        action={
          <Link to="/" className="button button-primary">
            {tr("开始新创作")}
          </Link>
        }
      />

      <div className="history-filter-bar">
        <div className="history-filter-tabs">
          <Button
            variant="ghost"
            aria-pressed={status === ""}
            onClick={() => {
              setStatus("");
              setCursors([""]);
            }}
          >
            {tr("全部")}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={status === "completed"}
            onClick={() => {
              setStatus("completed");
              setCursors([""]);
            }}
          >
            {tr("已完成")}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={status === "pending"}
            onClick={() => {
              setStatus("pending");
              setCursors([""]);
            }}
          >
            {tr("生成中")}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={status === "failed"}
            onClick={() => {
              setStatus("failed");
              setCursors([""]);
            }}
          >
            {tr("失败")}
          </Button>
        </div>
        <Button
          variant="secondary"
          size="small"
          disabled={loading}
          onClick={() => void reload()}
        >
          <RefreshCw size={14} />
          {tr("刷新")}
        </Button>
      </div>

      {(error || issue) && <Notice kind="error">{error || issue}</Notice>}

      {loading ? (
        <Loading />
      ) : !error && data ? (
        data.history.length === 0 ? (
          <Empty title={tr("暂无生成记录")}>
            <p style={{ margin: "8px 0 16px", color: "var(--muted)" }}>
              {status
                ? tr("暂无匹配任务，请调整筛选条件。")
                : tr("暂无生成任务，使用工具后会显示。")}
            </p>
            <Link to="/" className="button button-primary">
              {tr("去体验创作")}
            </Link>
          </Empty>
        ) : (
          <div className="history-grid">
            {data.history.map((g) => {
              const modality = getModality(g);
              return (
                <div key={g.id} className="history-card">
                  <div
                    className="history-card-media"
                    onClick={() => {
                      setSelectedId(g.id);
                      setCopied("");
                      setIssue("");
                    }}
                  >
                    {modality === "image" && g.output ? (
                      <img
                        src={g.output}
                        alt={g.prompt}
                        loading="lazy"
                        className="history-media-content"
                      />
                    ) : modality === "video" && g.output ? (
                      <div className="history-video-wrapper">
                        <video
                          src={g.output}
                          muted
                          loop
                          playsInline
                          onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                          className="history-media-content"
                        />
                        <div className="video-play-indicator">
                          <Play size={16} fill="currentColor" />
                        </div>
                      </div>
                    ) : modality === "audio" && g.output ? (
                      <div className="history-audio-preview">
                        <Music size={32} />
                        <audio
                          src={g.output}
                          controls
                          className="history-audio-player"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <div className="history-text-preview">
                        <FileText size={24} className="text-icon" />
                        <p className="text-snippet">
                          {g.output || g.prompt || tr("此任务暂无生成结果。")}
                        </p>
                      </div>
                    )}

                    <div className="history-media-badges">
                      <span className="history-tool-badge">
                        {modality === "image" && <ImageIcon size={12} />}
                        {modality === "video" && <VideoIcon size={12} />}
                        {modality === "audio" && <Music size={12} />}
                        {modality === "text" && <FileText size={12} />}
                        <span>{tr(getTool(g.tool_id)?.name || "AI 创作")}</span>
                      </span>
                      <span className={`history-status-badge status-${g.status}`}>
                        {tr(labelFor(taskStatuses, g.status))}
                      </span>
                    </div>

                    <div className="history-card-overlay">
                      <button
                        type="button"
                        className="overlay-btn"
                        title={tr("查看详情")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(g.id);
                        }}
                      >
                        <Eye size={17} />
                      </button>
                      {g.output && (
                        <button
                          type="button"
                          className="overlay-btn"
                          title={tr("下载")}
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadItem(g);
                          }}
                        >
                          <Download size={17} />
                        </button>
                      )}
                      {g.output && (
                        <button
                          type="button"
                          className="overlay-btn"
                          title={tr("复制")}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleCopy(g.output!, `card-out-${g.id}`);
                          }}
                        >
                          {copied === `card-out-${g.id}` ? (
                            <Check size={17} color="#10b981" />
                          ) : (
                            <Copy size={17} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="history-card-body">
                    <p className="history-card-prompt" title={g.prompt}>
                      {g.prompt}
                    </p>
                    <div className="history-card-meta">
                      <span className="history-card-time">
                        {formatDateTime(g.created_at, locale)}
                      </span>
                      <span className="history-card-cost">
                        {g.cost > 0 && `${g.cost} ${tr("积分")}`}
                        {g.refunded > 0 && ` (${tr("退回积分")} ${g.refunded})`}
                      </span>
                    </div>
                    <div className="history-card-actions">
                      {g.output && (
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => void downloadItem(g)}
                        >
                          <Download size={13} />
                          {tr("下载")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => setSelectedId(g.id)}
                      >
                        <Eye size={13} />
                        {tr("详情")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={Boolean(busy) || g.status === "pending"}
                        onClick={() => void handleDelete(g.id)}
                        aria-label={tr("删除记录")}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}

      <Modal
        open={!!selected}
        onClose={() => setSelectedId("")}
        title={tr("任务详情")}
        description={
          selected
            ? `${tr(getTool(selected.tool_id)?.name || "AI 创作")} · ${tr(labelFor(taskStatuses, selected.status))}`
            : tr("任务详情")
        }
        busy={!!busy}
      >
        {selected && (
          <div className="task-detail-content">
            {issue && <Notice kind="error">{tr(issue)}</Notice>}

            {/* Media showcase in detail modal */}
            {selectedModality === "image" && selected.output && (
              <div className="history-modal-media">
                <img src={selected.output} alt={selected.prompt} />
              </div>
            )}
            {selectedModality === "video" && selected.output && (
              <div className="history-modal-media">
                <video controls autoPlay src={selected.output} />
              </div>
            )}
            {selectedModality === "audio" && selected.output && (
              <div style={{ margin: "16px 0" }}>
                <audio controls src={selected.output} style={{ width: "100%" }} />
              </div>
            )}

            <p className="task-meta">
              {tr("任务编号：{0} · 预扣 {1} 积分 · 已退回{2}{3} 积分 {4}", [
                selected.id,
                selected.cost,
                " ",
                selected.refunded,
                selected.completed_at
                  ? ` · 完成于 ${formatDateTime(selected.completed_at, locale)}`
                  : "",
              ])}
            </p>

            {selected.error_code && (
              <Notice>
                {taskErrors[selected.error_code] || tr("任务未完成")}
              </Notice>
            )}

            <h3>{tr("输入内容")}</h3>
            <pre>{selected.prompt}</pre>

            {selectedModality === "text" && (
              <>
                <h3>{tr("生成结果")}</h3>
                <pre>{selected.output || tr("此任务暂无生成结果。")}</pre>
              </>
            )}

            <div className="record-actions" style={{ marginTop: "20px" }}>
              {selected.output && (
                <Button
                  variant="primary"
                  onClick={() => void downloadItem(selected)}
                >
                  <Download size={15} />
                  {selectedModality === "image"
                    ? tr("下载高清原图")
                    : selectedModality === "video"
                      ? tr("下载视频")
                      : tr("下载")}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() =>
                  handleCopy(selected.prompt, `prompt-${selected.id}`)
                }
              >
                <Copy size={15} />
                {copied === `prompt-${selected.id}`
                  ? tr("已复制")
                  : tr("复制提示词")}
              </Button>
              {selected.output && selectedModality === "text" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    handleCopy(selected.output!, `output-${selected.id}`)
                  }
                >
                  <Copy size={15} />
                  {copied === `output-${selected.id}`
                    ? tr("已复制")
                    : tr("复制结果")}
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={Boolean(busy) || selected.status === "pending"}
                onClick={() => void handleDelete(selected.id)}
              >
                <Trash2 size={15} />
                {busy === selected.id ? tr("正在删除…") : tr("删除记录")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <nav className="admin-pagination" aria-label={tr("生成历史分页")}>
        <span>{tr("第 {0} 页 · 每页 20 条", [cursors.length])}</span>
        <Button
          variant="secondary"
          disabled={loading || cursors.length === 1}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          {tr("上一页")}
        </Button>
        <Button
          variant="secondary"
          disabled={loading || !!error || !data?.nextCursor}
          onClick={() =>
            data?.nextCursor && setCursors((c) => [...c, data.nextCursor!])
          }
        >
          {tr("下一页")}
        </Button>
      </nav>
    </div>
  );
}
