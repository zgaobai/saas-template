import { useI18n } from "@/i18n/react";
import { useAuthDialog } from "@/modules/auth/components/auth-dialog";
import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  Check,
  Coins,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Film,
  Camera,
  Music,
  FileText,
  Video as VideoIcon,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Scanner } from "@/components/ui/scanner";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Overview } from "@/modules/tools/types";
import type { Tool } from "../catalog";
import { ToolIcon } from "./tool-icon";
import {
  trackToolGenerate,
  trackAuthModalOpen,
} from "@/modules/analytics/events";

const tones = ["自然清晰", "专业简洁", "轻松有趣"] as const;

export function ToolWorkbench({
  tool,
  aiReady,
  signedIn,
}: {
  tool: Tool;
  aiReady: boolean;
  signedIn: boolean;
}) {
  const { t: tr, locale } = useI18n();
  const openAuth = useAuthDialog();
  const { data, error, reload } = useResource<Overview>(
    signedIn ? "/api/app/overview" : null,
  );

  const modality = (tool as any).modality || "text";
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<string>("自然清晰");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1" | "21:9">("16:9");
  const [cameraMotion, setCameraMotion] = useState<"pan" | "orbit" | "aerial" | "static">("pan");
  const [genreTag, setGenreTag] = useState("lofi");
  const [output, setOutput] = useState("");
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [copied, setCopied] = useState(false);
  const [restored, setRestored] = useState(false);

  // Video playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const draftKey = `qihang:draft:${tool.id}`;

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (typeof draft?.prompt === "string")
        setPrompt(draft.prompt.slice(0, 2000));
      if (tones.includes(draft?.tone)) setTone(draft.tone);
      if (draft?.aspectRatio) setAspectRatio(draft.aspectRatio);
      if (draft?.cameraMotion) setCameraMotion(draft.cameraMotion);
    } catch {}
    setRestored(true);
  }, [draftKey]);

  useEffect(() => {
    if (restored)
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            prompt,
            tone,
            aspectRatio,
            cameraMotion,
          }),
        );
      } catch {}
  }, [prompt, tone, aspectRatio, cameraMotion, draftKey, restored]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            prompt,
            tone,
            aspectRatio,
            cameraMotion,
          }),
        );
      } catch {}
      trackAuthModalOpen("workbench_generate");
      openAuth("login", `/tools/${tool.id}`);
      return;
    }

    setBusy(true);
    setIssue("");
    setSample(false);
    setOutput("");
    setCopied(false);

    trackToolGenerate({
      toolId: tool.id,
      modality,
      tone,
      promptLength: prompt.length,
    });

    try {
      if (modality === "text") {
        const response = await fetch("/api/app/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            toolId: tool.id,
            locale,
            prompt,
            tone,
            stream: true,
          }),
        });

        if (!response.ok) {
          const err = (await response.json().catch(() => null)) as any;
          throw new Error(err?.error || tr("生成未完成，请稍后重试。"));
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error(tr("生成未完成，请稍后重试。"));
        }

        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setOutput(accumulated);
        }
      } else {
        const res = await api<{
          output: string;
        }>("/api/app/generate", {
          method: "POST",
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            toolId: tool.id,
            locale,
            prompt,
            stream: false,
          }),
        });
        setOutput(res.output);
      }
    } catch (e: any) {
      setIssue(e?.message || tr("生成未完成，请稍后重试。"));
    } finally {
      await reload();
      setBusy(false);
    }
  }

  const aspectOptions = [
    { id: "16:9", label: "16:9", sub: tr("横屏") },
    { id: "9:16", label: "9:16", sub: tr("竖屏") },
    { id: "1:1", label: "1:1", sub: tr("方形") },
    { id: "21:9", label: "21:9", sub: tr("宽银幕") },
  ] as const;

  const cameraOptions = [
    { id: "pan", label: tr("平移推镜") },
    { id: "orbit", label: tr("环绕运镜") },
    { id: "aerial", label: tr("航拍俯冲") },
    { id: "static", label: tr("固定镜头") },
  ] as const;

  return (
    <div className="wb-container">
      {/* 顶部精简导航 */}
      <header className="wb-header">
        <div className="wb-header-meta">
          <div className="wb-header-icon">
            <ToolIcon tool={tool} />
          </div>
          <div>
            <h1 className="wb-title">{tr(tool.name)}</h1>
            <p className="wb-desc">{tr(tool.description)}</p>
          </div>
        </div>

        <div className="wb-header-actions">
          {signedIn ? (
            <Link to="/billing" className="wb-balance-pill">
              <Coins size={14} className="text-muted" />
              <span>{data?.balance ?? "—"}</span>
              <span className="wb-balance-unit">{tr("积分")}</span>
            </Link>
          ) : (
            <span className="wb-cost-pill">
              {tr("每次成功生成 · 1 积分")}
            </span>
          )}
        </div>
      </header>

      {error && <Notice kind="error">{tr(error)}</Notice>}

      {/* 左右分栏：左侧参数配置，右侧内容画板 */}
      <div className="wb-workspace">
        <form className="wb-form" onSubmit={submit}>
          {/* 提示词输入区 */}
          <div className="wb-field-group">
            <div className="wb-field-head">
              <label htmlFor="prompt-input" className="wb-field-label">
                {tr(tool.label)}
              </label>
              <div className="wb-field-actions">
                <button
                  type="button"
                  className="wb-text-btn"
                  onClick={() => {
                    setPrompt(tr(tool.example));
                    setOutput(tr(tool.sample));
                    setSample(true);
                    setCopied(false);
                    setIssue("");
                  }}
                >
                  {tr("填入示例")}
                </button>
                {prompt && (
                  <button
                    type="button"
                    className="wb-text-btn"
                    onClick={() => setPrompt("")}
                  >
                    {tr("清空")}
                  </button>
                )}
              </div>
            </div>

            <textarea
              id="prompt-input"
              value={prompt}
              placeholder={tr(tool.placeholder)}
              onChange={(e) => setPrompt(e.target.value)}
              minLength={5}
              maxLength={2000}
              required
              disabled={busy}
              className="wb-textarea"
              rows={4}
            />

            <div className="wb-field-footer">
              <span className="wb-hint">{tr("描述越明确，生成效果越贴近预期。")}</span>
              <span className="wb-counter">{prompt.length} / 2000</span>
            </div>
          </div>

          {/* 画面比例 */}
          {(modality === "video" || modality === "image") && (
            <div className="wb-field-group">
              <label className="wb-field-label">{tr("画面比例")}</label>
              <div className="wb-segmented-grid">
                {aspectOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    className={`wb-segmented-item ${aspectRatio === opt.id ? "is-active" : ""}`}
                    onClick={() => setAspectRatio(opt.id)}
                  >
                    <span className="wb-segmented-main">{opt.label}</span>
                    <span className="wb-segmented-sub">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 运镜方式 (视频专属) */}
          {modality === "video" && (
            <div className="wb-field-group">
              <label className="wb-field-label">{tr("运镜方式")}</label>
              <div className="wb-segmented-grid">
                {cameraOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    className={`wb-segmented-item ${cameraMotion === opt.id ? "is-active" : ""}`}
                    onClick={() => setCameraMotion(opt.id)}
                  >
                    <span className="wb-segmented-main">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 语气风格 (文本专属) */}
          {modality === "text" && (
            <div className="wb-field-group">
              <label className="wb-field-label">{tr("表达语气")}</label>
              <div className="wb-segmented-grid">
                {tones.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={busy}
                    className={`wb-segmented-item ${tone === t ? "is-active" : ""}`}
                    onClick={() => setTone(t)}
                  >
                    <span className="wb-segmented-main">{tr(t)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 音乐风格 (音频专属) */}
          {modality === "audio" && (
            <div className="wb-field-group">
              <label className="wb-field-label">{tr("风格偏好")}</label>
              <div className="wb-segmented-grid">
                {[
                  { id: "lofi", label: "Lo-Fi" },
                  { id: "synthpop", label: "Synthwave" },
                  { id: "acoustic", label: "Acoustic" },
                  { id: "ambient", label: "Ambient" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    className={`wb-segmented-item ${genreTag === item.id ? "is-active" : ""}`}
                    onClick={() => setGenreTag(item.id)}
                  >
                    <span className="wb-segmented-main">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {issue && <Notice kind="error">{tr(issue)}</Notice>}

          {!aiReady && (
            <p className="wb-service-notice">
              {tr("生成服务尚未启用，可先查看示例，或填写内容留作草稿。")}
            </p>
          )}

          {/* 生成提交按钮 */}
          <div className="wb-submit-wrap">
            <button
              type="submit"
              disabled={
                busy || (signedIn && (!aiReady || !data || data.balance < 1))
              }
              className="wb-primary-btn"
            >
              {busy ? (
                <span>{tr("正在生成…")}</span>
              ) : !signedIn ? (
                <span>{tr("登录并继续")}</span>
              ) : (
                <span>
                  {modality === "video"
                    ? tr("生成视频")
                    : modality === "image"
                      ? tr("生成图像")
                      : tr("开始生成")}
                  {" · 1 "}
                  {tr("积分")}
                </span>
              )}
            </button>

            <span className="wb-submit-note">
              {signedIn
                ? tr("生成成功后自动归档至历史记录")
                : tr("登录后保留当前草稿")}
            </span>
          </div>

          {signedIn && data && data.balance < 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {data.freeQuotaCapped && (
                <small style={{ fontSize: "12px", color: "var(--color-warning-text, #d97706)" }}>
                  {tr("今日免费额度已发完（明日恢复），您可以升级套餐立即开始体验")}
                </small>
              )}
              <Link to="/pricing" className="wb-low-credit-link">
                {tr("积分不足，查看补充方案")}
              </Link>
            </div>
          )}
        </form>

        {/* 右侧画板 */}
        <section className="wb-stage">
          <div className="wb-stage-bar">
            <span className="wb-stage-title">
              {sample ? tr("示例预览") : tr("生成结果")}
            </span>

            {output && modality === "text" && (
              <button
                type="button"
                className="wb-text-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(output);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setIssue("复制失败，请选择文字手动复制。");
                  }
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? tr("已复制") : tr("复制")}</span>
              </button>
            )}
          </div>

          <div className={`wb-canvas wb-ratio-${aspectRatio.replace(":", "-")}`}>
            {busy && !output ? (
              <Scanner modality={modality} />
            ) : modality === "video" && output ? (
              <div className="wb-video-wrapper">
                <video
                  ref={videoRef}
                  src={output}
                  controls
                  loop
                  playsInline
                  autoPlay
                  className="wb-video-elem"
                />
              </div>
            ) : modality === "image" && output ? (
              <div className="wb-image-wrapper">
                <img
                  src={output}
                  alt={prompt || tr("生成结果")}
                  className="wb-image-elem"
                />
              </div>
            ) : modality === "audio" && output ? (
              <div className="wb-audio-wrapper">
                <div className="wb-audio-info">
                  <Music size={20} className="text-muted" />
                  <span>{prompt ? prompt.slice(0, 32) : tr("音频生成结果")}</span>
                </div>
                <audio controls src={output} className="wb-audio-elem" />
              </div>
            ) : output ? (
              <div className="wb-text-wrapper">
                <div className="wb-text-content">{output}</div>
                {busy && <span className="wb-cursor" />}
              </div>
            ) : (
              /* 空白状态 */
              <div className="wb-empty-state">
                <div className="wb-empty-icon">
                  {modality === "video" ? (
                    <VideoIcon size={28} strokeWidth={1.5} />
                  ) : modality === "image" ? (
                    <ImageIcon size={28} strokeWidth={1.5} />
                  ) : (
                    <FileText size={28} strokeWidth={1.5} />
                  )}
                </div>
                <p className="wb-empty-text">
                  {tr("填写左侧内容并点击生成，结果将在此呈现。")}
                </p>
                <button
                  type="button"
                  className="wb-secondary-btn"
                  onClick={() => {
                    setPrompt(tr(tool.example));
                    setOutput(tr(tool.sample));
                    setSample(true);
                    setCopied(false);
                    setIssue("");
                  }}
                >
                  {tr("填入示例")}
                </button>
              </div>
            )}
          </div>

          {/* 画板底部操作 */}
          {output && (
            <div className="wb-stage-footer">
              <span className="wb-footer-hint">
                {sample
                  ? tr("当前为展示示例，不扣除积分。")
                  : tr("内容由模型生成，请注意核对。")}
              </span>
              <div className="wb-footer-actions">
                <a
                  href={output}
                  target="_blank"
                  rel="noreferrer"
                  download={`export-${tool.id}`}
                  className="wb-action-btn"
                >
                  <Download size={13} />
                  <span>{tr("下载")}</span>
                </a>
                <button
                  type="button"
                  className="wb-action-btn"
                  onClick={() => {
                    setOutput("");
                    setSample(false);
                  }}
                >
                  <RotateCcw size={13} />
                  <span>{tr("重置")}</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
