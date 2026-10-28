import { useI18n } from "@/i18n/react";
import { useEffect, useState } from "react";
import { X, Sparkles, Info, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AnnouncementItem } from "@/modules/admin/types";

export function AnnouncementBanner() {
  const { t: tr } = useI18n();
  const [announcement, setAnnouncement] = useState<AnnouncementItem | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/app/public/announcements/active")
      .then((res) => (res.ok ? (res.json() as Promise<{ announcement?: AnnouncementItem | null }>) : null))
      .then((data) => {
        if (!active || !data?.announcement) return;
        const item = data.announcement;
        const isDismissed =
          typeof window !== "undefined" &&
          item.dismissible &&
          localStorage.getItem(`dismissed-announcement-${item.id}`) === "1";

        if (!isDismissed) {
          setAnnouncement(item);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (!announcement || dismissed) return null;

  function handleDismiss() {
    if (typeof window !== "undefined" && announcement) {
      localStorage.setItem(`dismissed-announcement-${announcement.id}`, "1");
    }
    setDismissed(true);
  }

  const typeStyles = {
    info: {
      bg: "linear-gradient(90deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.15))",
      border: "rgba(99, 102, 241, 0.3)",
      badgeBg: "rgba(59, 130, 246, 0.25)",
      badgeColor: "#93c5fd",
      icon: Info,
      label: tr("公告"),
    },
    promotion: {
      bg: "linear-gradient(90deg, rgba(234, 88, 12, 0.15), rgba(249, 115, 22, 0.15))",
      border: "rgba(249, 115, 22, 0.35)",
      badgeBg: "rgba(249, 115, 22, 0.25)",
      badgeColor: "#fdba74",
      icon: Sparkles,
      label: tr("活动"),
    },
    warning: {
      bg: "linear-gradient(90deg, rgba(234, 179, 8, 0.15), rgba(202, 138, 4, 0.15))",
      border: "rgba(234, 179, 8, 0.35)",
      badgeBg: "rgba(234, 179, 8, 0.25)",
      badgeColor: "#fde047",
      icon: AlertTriangle,
      label: tr("提醒"),
    },
  }[announcement.type || "info"];

  const Icon = typeStyles.icon;

  return (
    <aside
      className="announcement-banner"
      role="banner"
      style={{
        background: typeStyles.bg,
        borderBottom: `1px solid ${typeStyles.border}`,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.875rem",
        position: "relative",
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "center",
          paddingRight: announcement.dismissible ? "28px" : "0",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: typeStyles.badgeBg,
            color: typeStyles.badgeColor,
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          <Icon size={12} />
          {typeStyles.label}
        </span>
        <strong style={{ fontWeight: 600 }}>{announcement.title}</strong>
        <span style={{ opacity: 0.9 }}>{announcement.content}</span>
        {announcement.link_url && (
          <Link
            to={announcement.link_url as any}
            style={{
              color: typeStyles.badgeColor,
              textDecoration: "underline",
              fontWeight: 500,
              marginLeft: "4px",
            }}
          >
            {announcement.link_text || tr("查看详情")}
          </Link>
        )}
      </div>
      {Boolean(announcement.dismissible) && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={tr("关闭公告")}
          style={{
            position: "absolute",
            right: "12px",
            background: "none",
            border: "none",
            color: "inherit",
            opacity: 0.6,
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            borderRadius: "4px",
          }}
        >
          <X size={16} />
        </button>
      )}
    </aside>
  );
}
