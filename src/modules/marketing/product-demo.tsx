import { useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  AlignLeft,
  WandSparkles,
  PenLine,
  Languages,
  Video,
  Image as ImageIcon,
  Copy,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Film,
  Camera,
  Layers,
} from "lucide-react";
import { tools } from "@/modules/tools/catalog";

const showcaseIds = ["video", "image", "copywriting", "translate"];
const showcaseTools = showcaseIds
  .map((id) => tools.find((t) => t.id === id))
  .filter(Boolean) as (typeof tools)[number][];

const cameraMotions = ["平移推镜", "环绕运镜", "航拍俯冲"] as const;
const aspectRatios = ["16:9", "9:16", "1:1"] as const;
const artStyles = ["赛博朋克", "胶片摄影", "二次元动漫"] as const;
const textTones = ["自然清晰", "专业简洁", "轻松有趣"] as const;
const transTones = ["自然地道", "商务正式", "日常口语"] as const;

export function ProductDemo() {
  const { t: tr } = useI18n();
  const [activeId, setActiveId] = useState<string>("video");
  const [selectedMotion, setSelectedMotion] = useState<string>("平移推镜");
  const [selectedRatio, setSelectedRatio] = useState<string>("16:9");
  const [selectedStyle, setSelectedStyle] = useState<string>("赛博朋克");
  const [selectedTone, setSelectedTone] = useState<string>("自然清晰");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const tool =
    showcaseTools.find((t) => t.id === activeId) || showcaseTools[0];
  const modality = (tool as any)?.modality || "text";

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
        });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <section
      className="product-window-wrapper"
      id="demo"
      aria-label={tr("工具效果示例")}
    >
      <div className="product-window">
        {/* macOS Window Chrome Header */}
        <div className="window-bar">
          <div className="window-dots" aria-hidden="true">
            <i className="dot-red" />
            <i className="dot-yellow" />
            <i className="dot-green" />
          </div>
          <div className="window-center-title">
            <span>{tr("启航 · 创作空间")}</span>
          </div>
          <div className="window-status-area">
            <span className="demo-status-pill">
              {tr("AI 服务运行正常")}
            </span>
          </div>
        </div>

        {/* Studio Body Layout */}
        <div className="demo-layout">
          {/* Tool Navigation Rail */}
          <aside className="demo-sidebar">
            <span className="demo-sidebar-title">{tr("选择工具")}</span>
            <div className="demo-nav-list">
              {showcaseTools.map((t) => {
                const isActive = t.id === activeId;
                const Icon =
                  t.id === "video"
                    ? Video
                    : t.id === "image"
                      ? ImageIcon
                      : t.id === "copywriting"
                        ? PenLine
                        : Languages;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={isActive}
                    className={`demo-nav-btn ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setActiveId(t.id);
                      setCopied(false);
                      setError("");
                      setIsPlaying(true);
                    }}
                  >
                    <span className="demo-nav-icon">
                      <Icon size={16} />
                    </span>
                    <span className="demo-nav-name">{tr(t.name)}</span>
                    {isActive && <span className="demo-active-pip" />}
                  </button>
                );
              })}
            </div>
            <HomeSectionLink section="tools" className="demo-all">
              <span>{tr("查看全部工具")}</span>
              <ArrowRight size={13} />
            </HomeSectionLink>
          </aside>

          {/* Left Input Configuration Panel */}
          <div className="demo-input">
            <div className="demo-panel-title">
              <span className="panel-title-badge">
                <AlignLeft size={14} />
                {tr("输入内容")}
              </span>
              <span className="demo-char-count">{tool.example.length} 字</span>
            </div>

            <div className="demo-input-card">
              <p>{tr(tool.example)}</p>
            </div>

            {/* Dynamic Controls Based on Modality */}
            {modality === "video" && (
              <div className="demo-modality-controls">
                <div className="demo-control-group">
                  <span className="demo-tone-label">
                    <Camera size={13} />
                    {tr("运镜方式")}
                  </span>
                  <div className="demo-tone-options">
                    {cameraMotions.map((motion) => (
                      <button
                        key={motion}
                        type="button"
                        className={`demo-tone-chip ${selectedMotion === motion ? "active" : ""}`}
                        onClick={() => setSelectedMotion(motion)}
                      >
                        {tr(motion)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="demo-control-group">
                  <span className="demo-tone-label">
                    <Layers size={13} />
                    {tr("画面比例")}
                  </span>
                  <div className="demo-tone-options">
                    {aspectRatios.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        className={`demo-tone-chip ${selectedRatio === ratio ? "active" : ""}`}
                        onClick={() => setSelectedRatio(ratio)}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {modality === "image" && (
              <div className="demo-modality-controls">
                <div className="demo-control-group">
                  <span className="demo-tone-label">
                    <Sparkles size={13} />
                    {tr("画面风格")}
                  </span>
                  <div className="demo-tone-options">
                    {artStyles.map((style) => (
                      <button
                        key={style}
                        type="button"
                        className={`demo-tone-chip ${selectedStyle === style ? "active" : ""}`}
                        onClick={() => setSelectedStyle(style)}
                      >
                        {tr(style)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="demo-control-group">
                  <span className="demo-tone-label">
                    <Layers size={13} />
                    {tr("画面比例")}
                  </span>
                  <div className="demo-tone-options">
                    {aspectRatios.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        className={`demo-tone-chip ${selectedRatio === ratio ? "active" : ""}`}
                        onClick={() => setSelectedRatio(ratio)}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {modality === "text" && (
              <div className="demo-tone-picker">
                <span className="demo-tone-label">{tr("表达语气")}</span>
                <div className="demo-tone-options">
                  {(tool.id === "translate" ? transTones : textTones).map(
                    (toneName) => (
                      <button
                        key={toneName}
                        type="button"
                        className={`demo-tone-chip ${selectedTone === toneName ? "active" : ""}`}
                        onClick={() => setSelectedTone(toneName)}
                      >
                        {tr(toneName)}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            <Link
              to="/tools/$toolId"
              params={{
                toolId: tool.id,
              }}
              className="button button-primary demo-action-btn shimmer-btn"
            >
              <span>{tr("打开工具试试")}</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Right Live Result Showcase Panel (Video / Canvas / Text) */}
          <div className="demo-result" aria-live="polite">
            <div className="demo-panel-title demo-result-header">
              <span className="panel-title-badge result-badge">
                <Sparkles size={14} />
                {modality === "video"
                  ? tr("实时视频渲染")
                  : modality === "image"
                    ? tr("AI 绘图生图")
                    : tr("示例结果")}
              </span>
              <div className="demo-header-actions">
                <span className="demo-metric-chip">
                  {modality === "video"
                    ? "4K · 60fps · 16:9"
                    : modality === "image"
                      ? "8K Ultra-HD · HDR"
                      : "⚡ 0.6s · 328 字"}
                </span>

                {modality === "text" && (
                  <button
                    type="button"
                    className="demo-copy-btn"
                    aria-label={tr("复制示例结果")}
                    title={copied ? tr("已复制到剪贴板") : tr("复制示例结果")}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(tr(tool.sample));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      } catch {
                        setError("复制失败，请选择文本手动复制。");
                      }
                    }}
                  >
                    {copied ? (
                      <>
                        <Check size={14} className="text-positive" />
                        <span className="copy-label">
                          {tr("已复制到剪贴板")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span className="copy-label">{tr("复制")}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Cinematic Multi-modal Output Preview */}
            {modality === "video" ? (
              <div className="cinematic-video-canvas">
                <video
                  ref={videoRef}
                  src={tool.sample}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  poster="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"
                  className="cinematic-player"
                />
                <div className="video-player-overlay">
                  <div className="player-badge-row">
                    <span className="video-hd-badge">4K PRO</span>
                    <span className="video-motion-badge">
                      {tr(selectedMotion)}
                    </span>
                  </div>
                  <div className="player-controls-row">
                    <button
                      type="button"
                      className="player-control-btn"
                      onClick={togglePlay}
                      aria-label={isPlaying ? tr("暂停") : tr("播放")}
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      type="button"
                      className="player-control-btn"
                      onClick={toggleMute}
                      aria-label={isMuted ? tr("取消静音") : tr("静音")}
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <span className="video-time-track">00:04 / 00:08</span>
                    <Link
                      to="/tools/$toolId"
                      params={{ toolId: "video" }}
                      className="player-control-btn player-maximize"
                      title={tr("全屏预览")}
                    >
                      <Maximize2 size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            ) : modality === "image" ? (
              <div className="cinematic-image-canvas">
                <img
                  src={tool.sample}
                  alt={tr(tool.example)}
                  className="cinematic-img"
                />
                <div className="image-overlay-badge">
                  <span className="video-hd-badge">8K FLUX</span>
                  <span className="video-motion-badge">
                    {tr(selectedStyle)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="demo-output-card">
                <p>{tr(tool.sample)}</p>
              </div>
            )}

            {error && (
              <span role="alert" className="demo-error-notice">
                {tr(error)}
              </span>
            )}

            <div className="demo-result-note">
              <Check size={13} className="note-check-icon" />
              <span>
                {modality === "video"
                  ? tr("视频渲染完成") + " · " + tr("这是固定示例，真实结果由 AI 生成。")
                  : tr("这是固定示例，真实结果由 AI 生成。")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
