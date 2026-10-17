import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Keep the value on one line; copying never expands or duplicates table rows. */
export function CompactValue({
  value,
  label = "完整内容",
  copyOnly = false,
}: {
  value: string;
  label?: string;
  copyOnly?: boolean;
}) {
  const { t: tr, locale } = useI18n();
  const [message, setMessage] = useState("");
  return (
    <span
      className={`compact-value${copyOnly ? " compact-value-copy-only" : ""}`}
    >
      {!copyOnly && (
        <span className="compact-value-text" title={value}>
          {value}
        </span>
      )}
      <button
        type="button"
        className="compact-copy"
        title={message || tr("复制{0}", [label])}
        aria-label={tr("复制{0}", [label])}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("已复制");
          } catch {
            setMessage("复制失败，请选中文字复制");
          }
        }}
      >
        {message === tr("已复制") ? <Check size={13} /> : <Copy size={13} />}
        {copyOnly &&
          (message === tr("已复制") ? tr("已复制") : tr("复制兑换码"))}
      </button>
      <span className="compact-copy-status" role="status">
        {tr(message)}
      </span>
    </span>
  );
}
