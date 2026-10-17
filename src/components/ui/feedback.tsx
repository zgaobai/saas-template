import { useI18n } from "@/i18n/react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
export function Notice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success";
}) {
  const { t: tr } = useI18n();
  return (
    <div
      className={`notice notice-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <span>{tr(children)}</span>
    </div>
  );
}
export function Loading() {
  const { t: tr, locale } = useI18n();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} />
      {tr("正在加载…")}
    </div>
  );
}
export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <div className="empty">
      {icon && (
        <span className="empty-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3>{tr(title)}</h3>
      <p>{children}</p>
    </div>
  );
}
