import { useI18n } from "@/i18n/react";
import { useAuthDialog } from "@/modules/auth/components/auth-dialog";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  Check,
  ArrowRight,
  WandSparkles,
  Sparkles,
  Download,
  Maximize2,
  Play,
  Pause,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Notice, Loading } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Overview } from "@/modules/tools/types";
import type { Tool } from "../catalog";
import { ToolIcon } from "./tool-icon";

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
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [cameraMotion, setCameraMotion] = useState("pan");
  const [genreTag, setGenreTag] = useState("lofi");
  const [output, setOutput] = useState("");
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [copied, setCopied] = useState(false);
  const [restored, setRestored] = useState(false);

  const draftKey = `qihang:draft:${tool.id}`;

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (typeof draft?.prompt === "string")
        setPrompt(draft.prompt.slice(0, 2000));
      if (tones.includes(draft?.tone)) setTone(draft.tone);
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
          }),
        );
      } catch {}
  }, [prompt, tone, draftKey, restored]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            prompt,
            tone,
          }),
        );
      } catch {}
      openAuth("login", `/tools/${tool.id}`);
      return;
    }

    setBusy(true);
    setIssue("");
    setSample(false);
    setOutput("");
    setCopied(false);

    try {
      if (modality === "text") {
        // Progressive token streaming for text tools
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
        // Multimodal tools (Image, Video, Audio)
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

  const renderModalitySpecificControls = () => {
    if (modality === "image") {
      return (
        <fieldset className="tone-picker" disabled={busy}>
          <legend>{tr("画面比例与构图")}</legend>
          {[
            { id: "1:1", label: tr("1:1 方形头像/插画") },
            { id: "16:9", label: tr("16:9 横屏封面壁纸") },
            { id: "9:16", label: tr("9:16 竖屏社媒海报") },
          ].map((item) => (
            <label
              key={item.id}
              className={aspectRatio === item.id ? "selected" : ""}
            >
              <input
                name="aspectRatio"
                type="radio"
                value={item.id}
                checked={aspectRatio === item.id}
                onChange={() => setAspectRatio(item.id)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      );
    }

    if (modality === "video") {
      return (
        <fieldset className="tone-picker" disabled={busy}>
          <legend>{tr("运镜方式与动效")}</legend>
          {[
            { id: "pan", label: tr("平移推镜 (Pan/Zoom)") },
            { id: "orbit", label: tr("环绕运镜 (Orbit)") },
            { id: "aerial", label: tr("航拍俯冲 (Aerial)") },
          ].map((item) => (
            <label
              key={item.id}
              className={cameraMotion === item.id ? "selected" : ""}
            >
              <input
                name="cameraMotion"
                type="radio"
                value={item.id}
                checked={cameraMotion === item.id}
                onChange={() => setCameraMotion(item.id)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      );
    }

    if (modality === "audio") {
      return (
        <fieldset className="tone-picker" disabled={busy}>
          <legend>{tr("音乐风格与情绪")}</legend>
          {[
            { id: "lofi", label: tr("Lo-Fi 轻松专注") },
            { id: "synthpop", label: tr("电子流行 (Synth)") },
            { id: "acoustic", label: tr("治愈原声 (Acoustic)") },
            { id: "cyberpunk", label: tr("赛博朋克 (Cyber)") },
          ].map((item) => (
            <label
              key={item.id}
              className={genreTag === item.id ? "selected" : ""}
            >
              <input
                name="genreTag"
                type="radio"
                value={item.id}
                checked={genreTag === item.id}
                onChange={() => setGenreTag(item.id)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      );
    }

    // Default text tone picker
    return (
      <fieldset className="tone-picker" disabled={busy}>
        <legend>{tr("表达语气")}</legend>
        {tones.map((t) => (
          <label key={t} className={tone === t ? "selected" : ""}>
            <input
              name="tone"
              type="radio"
              value={t}
              checked={tone === t}
              onChange={() => setTone(t)}
            />
            {tr(t)}
          </label>
        ))}
      </fieldset>
    );
  };

  const renderResultContent = () => {
    if (busy && !output) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
            gap: "12px",
          }}
        >
          <Loading />
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>
            {modality === "image"
              ? tr("🎨 AI 正在绘制高清图像，请稍候…")
              : modality === "video"
                ? tr("🎬 AI 正在渲染电影级运镜与视频帧…")
                : modality === "audio"
                  ? tr("🎵 AI 正在编排旋律与生成音轨…")
                  : tr("思考构思中，即将流式输出…")}
          </p>
        </div>
      );
    }

    if (modality === "image" && output) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              position: "relative",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
              backgroundColor: "rgba(0,0,0,0.05)",
            }}
          >
            <img
              src={output}
              alt={prompt || tr("AI 图像生成结果")}
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "440px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <a
              href={output}
              target="_blank"
              rel="noreferrer"
              download="ai-generated-image.jpg"
              className="button-ghost"
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Download size={14} /> {tr("下载高清原图")}
            </a>
          </div>
        </div>
      );
    }

    if (modality === "video" && output) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border)",
              backgroundColor: "#000",
            }}
          >
            <video
              controls
              autoPlay
              muted
              loop
              playsInline
              src={output}
              style={{ width: "100%", maxHeight: "400px", display: "block" }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <a
              href={output}
              target="_blank"
              rel="noreferrer"
              download="ai-video.mp4"
              className="button-ghost"
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Download size={14} /> {tr("下载视频")}
            </a>
          </div>
        </div>
      );
    }

    if (modality === "audio" && output) {
      return (
        <div
          style={{
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface-raised, rgba(0,0,0,0.02))",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "8px",
                background: "var(--accent-solid)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Volume2 size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
                {prompt ? prompt.slice(0, 30) : tr("AI 创作音乐")}
              </h4>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {tr("AI 音乐生成 · 320kbps 高清音轨")}
              </span>
            </div>
          </div>

          {/* 模拟动态音频声波条 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              height: "36px",
              padding: "0 10px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "6px",
            }}
          >
            {[40, 70, 30, 85, 60, 95, 45, 80, 55, 90, 35, 75, 50, 100, 65, 85, 40, 70].map(
              (h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    background: "var(--accent)",
                    borderRadius: "2px",
                    opacity: 0.8,
                  }}
                />
              ),
            )}
          </div>

          <audio controls src={output} style={{ width: "100%", outline: "none" }} />
        </div>
      );
    }

    if (output) {
      return (
        <div className="generated-text" style={{ whiteSpace: "pre-wrap" }}>
          {output}
          {busy && (
            <span
              style={{
                display: "inline-block",
                width: "2px",
                height: "1.1em",
                backgroundColor: "var(--accent)",
                marginLeft: "3px",
                verticalAlign: "text-bottom",
                animation: "pulse 0.9s infinite",
              }}
            />
          )}
        </div>
      );
    }

    return (
      <div className="result-empty">
        <WandSparkles size={30} strokeWidth={1.3} />
        <h3>{tr("下一份好内容，从这里开始")}</h3>
        <p>
          {tr("填写内容后生成，结果会显示在这里。")}
          <br />
          {tr("也可以先点「试试示例」了解效果。")}
        </p>
      </div>
    );
  };

  return (
    <>
      <div className="tool-page-heading">
        <div className="tool-title">
          <ToolIcon tool={tool} />
          <div>
            <h1>{tr(tool.name)}</h1>
            <p>{tr(tool.description)}</p>
          </div>
        </div>
        {signedIn ? (
          <Link to="/billing" className="balance-chip">
            <Sparkles size={15} />
            {data?.balance ?? "—"} {tr("积分")}
            <ArrowRight size={14} />
          </Link>
        ) : (
          <span className="tool-cost">{tr("每次成功生成 · 1 积分")}</span>
        )}
      </div>

      {error && <Notice kind="error">{tr(error)}</Notice>}

      <div className="workspace tool-workspace">
        <form className="compose" onSubmit={submit}>
          <div className="panel-title">
            <h2>{tr("输入内容")}</h2>
            <button
              type="button"
              className="example-button"
              disabled={busy}
              onClick={() => {
                setPrompt(tr(tool.example));
                setOutput(tr(tool.sample));
                setSample(true);
                setCopied(false);
                setIssue("");
              }}
            >
              {tr("试试示例")}
              <ArrowRight size={14} />
            </button>
          </div>

          <Field id="tool-prompt" label={tr(tool.label)}>
            <Textarea
              id="tool-prompt"
              value={prompt}
              placeholder={tr(tool.placeholder)}
              onChange={(e) => setPrompt(e.target.value)}
              minLength={5}
              maxLength={2000}
              required
              disabled={busy}
            />
          </Field>

          <div className="input-meta">
            <span>{tr("越具体，越贴近你想要的结果。")}</span>
            <span>{prompt.length} / 2000</span>
          </div>

          {/* 模态专属选项控制 */}
          {renderModalitySpecificControls()}

          {issue && <Notice kind="error">{tr(issue)}</Notice>}

          {!aiReady && (
            <p className="service-hint">
              {tr("生成服务尚未启用，可先查看示例，或填写内容留作草稿。")}
            </p>
          )}

          <div className="compose-footer">
            <span>
              {signedIn
                ? tr("成功后自动保存到创作记录")
                : tr("登录后保留当前草稿")}
            </span>
            <Button
              type="submit"
              disabled={
                busy || (signedIn && (!aiReady || !data || data.balance < 1))
              }
            >
              {busy
                ? tr("正在生成…")
                : !signedIn
                  ? tr("登录并继续")
                  : tr("开始生成")}
              <WandSparkles size={17} />
            </Button>
          </div>

          {signedIn && data && data.balance < 1 && (
            <Link to="/pricing" className="low-credit-link">
              {tr("积分不足，查看补充方案 →")}
            </Link>
          )}
        </form>

        <section className="result-panel" aria-live="polite" aria-busy={busy}>
          <div className="panel-title">
            <h2>{sample ? tr("示例结果") : tr("生成结果")}</h2>
            {output && modality === "text" && (
              <Button
                variant="ghost"
                size="small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(output);
                    setCopied(true);
                  } catch {
                    setIssue("复制失败，请选择文字手动复制。");
                  }
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                {copied ? tr("已复制") : tr("复制")}
              </Button>
            )}
          </div>

          {renderResultContent()}

          <div className="result-note">
            {sample
              ? tr("预置示例，仅用于展示效果，不消耗积分。")
              : tr("AI 生成内容，请在使用前核实与调整。")}
          </div>
        </section>
      </div>

      <div className="tool-tips">
        <h2>{tr("让结果更贴近你的需求")}</h2>
        <p>
          {tr(
            "提供必要的背景、目标读者和具体用途；避免填写密码等敏感信息。草稿暂存在当前浏览器标签页中，生成结果仅在登录后保存到账户。",
          )}
        </p>
      </div>
    </>
  );
}
