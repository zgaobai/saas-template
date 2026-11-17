import * as React from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/react";
import { cn } from "@/lib/utils";

interface ScannerProps {
  modality?: "video" | "image" | "audio" | "text";
  statusText?: string;
  className?: string;
}

export function Scanner({
  modality = "video",
  statusText,
  className,
}: ScannerProps) {
  const { t: tr } = useI18n();
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  const defaultLabel =
    modality === "video"
      ? tr("正在生成视频…")
      : modality === "image"
        ? tr("正在绘制图像…")
        : modality === "audio"
          ? tr("正在生成音频…")
          : tr("正在生成文本…");

  return (
    <div className={cn("generation-loader", className)} aria-live="polite">
      <div className="generation-loader-content">
        <Loader2 size={24} className="generation-spinner" />
        <div className="generation-loader-info">
          <p className="generation-loader-title">{statusText || defaultLabel}</p>
          <span className="generation-loader-time">{formatTime(seconds)}</span>
        </div>
      </div>
    </div>
  );
}
