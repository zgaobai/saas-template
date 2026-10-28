import { useI18n } from "@/i18n/react";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, FileText, Download, Trash2 } from "lucide-react";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Empty, Loading, Notice } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm-dialog";
type FileRow = {
  id: string;
  name: string;
  size: number;
  created_at: number;
  status: string;
};
export const Route = createFileRoute("/_app/files")({
  component: Page,
});
function Page() {
  const { t: tr, locale } = useI18n();
  const { data, error, loading, reload } = useResource<{
    files: FileRow[];
  }>("/api/app/files");
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setIssue("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api("/api/app/files", {
        method: "POST",
        body: form,
      });
      toast.success(tr("文件上传成功"));
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr("上传失败");
      setIssue(msg);
      toast.error(msg);
      await reload();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <PageHeading
        title={tr("把创作素材，放在一起。")}
        description={tr(
          "仅你可访问。支持图片、PDF 和 TXT，单文件不超过 10 MB，总计最多 100 MB。",
        )}
        action={
          <Button onClick={() => input.current?.click()} disabled={busy}>
            <Upload size={17} />
            {busy ? tr("正在上传…") : tr("上传文件")}
          </Button>
        }
      />
      <input
        ref={input}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
        hidden
        aria-label={tr("选择文件")}
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {(issue || error) && <Notice kind="error">{issue || error}</Notice>}
      {loading ? (
        <Loading />
      ) : !data?.files.length ? (
        <Empty title={tr("这里还没有文件")}>
          {tr("上传产品资料或创作素材，方便随时下载使用。")}
        </Empty>
      ) : (
        <div className="file-list">
          {data.files.map((f) => (
            <div key={f.id} className="file-row">
              <FileText size={25} />
              <div>
                <strong>{f.name}</strong>
                <span>
                  {(f.size / 1024).toFixed(1)} KB ·{" "}
                  {new Date(f.created_at).toLocaleDateString("zh-CN")}
                </span>
                {f.status !== "ready" && (
                  <span>{tr("文件未完成处理，可手动删除后重新上传。")}</span>
                )}
              </div>
              {f.status === "ready" && (
                <a
                  href={`/api/app/files/${f.id}`}
                  className="button button-ghost"
                  aria-label={tr("下载 {0}", [f.name])}
                >
                  <Download size={18} />
                </a>
              )}
              <Button
                variant="ghost"
                aria-label={tr("删除 {0}", [f.name])}
                disabled={busy}
                onClick={async () => {
                  const ok = await confirmAction({
                    title: tr("删除文件确认"),
                    description: tr("确定删除此文件吗？"),
                    confirmText: tr("确认删除"),
                    variant: "danger",
                  });
                  if (!ok) return;
                  setBusy(true);
                  setIssue("");
                  try {
                    await api(`/api/app/files/${f.id}`, {
                      method: "DELETE",
                    });
                    toast.success(tr("文件已删除"));
                    await reload();
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : tr("删除失败");
                    setIssue(msg);
                    toast.error(msg);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={18} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
