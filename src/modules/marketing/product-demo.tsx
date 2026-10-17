import { useI18n } from "@/i18n/react";
import { HomeSectionLink } from "@/components/layout/home-section-link";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, AlignLeft, WandSparkles, Copy } from "lucide-react";
import { tools } from "@/modules/tools/catalog";
const demos = tools.slice(0, Math.min(3, tools.length));
export function ProductDemo() {
  const { t: tr, locale } = useI18n();
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const tool = demos[index] || demos[0] || tools[0];
  if (!tool) return null;
  return (
    <section
      className="product-window"
      id="demo"
      aria-label={tr("工具效果示例")}
    >
      <div className="window-bar">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{tr("启航 AI · 创作空间")}</span>
        <span className="demo-label">{tr("预置示例 · 不消耗积分")}</span>
      </div>
      <div className="demo-layout">
        <aside className="demo-sidebar">
          <span className="demo-sidebar-title">{tr("选择工具")}</span>
          {demos.map((t, i) => (
            <button
              key={t.id}
              aria-pressed={i === index}
              className={i === index ? "active" : ""}
              onClick={() => {
                setIndex(i);
                setCopied(false);
                setError("");
              }}
            >
              <WandSparkles size={16} />
              {tr(t.name)}
            </button>
          ))}
          <HomeSectionLink section="tools" className="demo-all">
            {tr("查看全部工具")}
            <ArrowRight size={14} />
          </HomeSectionLink>
        </aside>
        <div className="demo-input">
          <div className="demo-panel-title">
            <AlignLeft size={16} />
            {tr("输入内容")}
          </div>
          <p>{tr(tool.example)}</p>
          <div className="demo-tone">
            <span>{tr("表达语气")}</span>
            <strong>{tr("自然清晰")}</strong>
          </div>
          <Link
            to="/tools/$toolId"
            params={{
              toolId: tool.id,
            }}
            className="button button-primary"
          >
            {tr("打开工具试试")}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="demo-result" aria-live="polite">
          <div className="demo-panel-title">
            <span>
              <WandSparkles size={16} />
              {tr("示例结果")}
            </span>
            <button
              aria-label={tr("复制示例结果")}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(tr(tool.sample));
                  setCopied(true);
                } catch {
                  setError("复制失败，请选择文本手动复制。");
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <p>{tr(tool.sample)}</p>
          {error && <span role="alert">{tr(error)}</span>}
          <span className="demo-result-note">
            <Check size={13} />
            {tr("这是固定示例，真实结果由 AI 生成。")}
          </span>
        </div>
      </div>
    </section>
  );
}
