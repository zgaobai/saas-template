import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { Film, Sparkles, Play, ArrowRight, Video } from "lucide-react";

export function VideoShowreel() {
  const { t: tr } = useI18n();

  const showreelItems = [
    {
      id: "mountain",
      title: "CineMotion · 60fps",
      tag: "4K HDR",
      prompt: "航拍穿越晨雾缭绕的雪山峡谷，朝阳将金色光芒洒在山脊上，镜头缓慢向前推进。",
      video:
        "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
      poster:
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
      ratio: "16:9",
    },
    {
      id: "ocean",
      title: "Fluid Physics · 120fps",
      tag: "Ultra Slow-Mo",
      prompt: "微距慢动作捕捉碧蓝海浪翻滚破碎瞬间，水珠晶莹剔透，柔和逆光摄影。",
      video:
        "https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4",
      poster:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      ratio: "16:9",
    },
    {
      id: "sunset",
      title: "Skyline Motion · 8K",
      tag: "Timelapse",
      prompt: "日落时分高空俯瞰云海翻腾，橘红色晚霞浸润云层，史诗级电影运镜。",
      video:
        "https://assets.mixkit.co/videos/preview/mixkit-clouds-and-blue-sky-2408-large.mp4",
      poster:
        "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80",
      ratio: "16:9",
    },
  ];

  return (
    <section className="showreel-section container" id="showreel">
      <div className="marketing-heading">
        <div className="feature-pill-badge">
          <Film size={13} />
          <span>{tr("精选创作灵感")}</span>
        </div>
        <h2>{tr("社区精选生成作品")}</h2>
        <p>
          {tr("查看社区创作者的优秀生成案例，获取提示词与构图灵感。")}
        </p>
      </div>

      <div className="showreel-grid">
        {showreelItems.map((item) => (
          <article key={item.id} className="showreel-card">
            <div className="showreel-video-wrapper">
              <video
                src={item.video}
                poster={item.poster}
                autoPlay
                loop
                muted
                playsInline
                className="showreel-video"
              />
              <div className="showreel-overlay">
                <div className="showreel-badge-row">
                  <span className="showreel-model-badge">{item.title}</span>
                  <span className="showreel-tag-badge">{item.tag}</span>
                </div>
                <div className="showreel-play-indicator" aria-hidden="true">
                  <Play size={16} fill="currentColor" />
                </div>
              </div>
            </div>

            <div className="showreel-body">
              <p className="showreel-prompt">“{tr(item.prompt)}”</p>
              <div className="showreel-action-row">
                <Link
                  to="/tools/$toolId"
                  params={{ toolId: "video" }}
                  className="showreel-remix-btn"
                >
                  <Sparkles size={13} />
                  <span>{tr("制作同款")}</span>
                  <ArrowRight size={13} />
                </Link>
                <span className="showreel-cost">⚡ 1 积分</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="showreel-footer-cta">
        <Link
          to="/tools/$toolId"
          params={{ toolId: "video" }}
          className="button button-secondary hero-btn-secondary"
        >
          <Video size={16} className="text-accent" />
          <span>{tr("查看视频工具")}</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
