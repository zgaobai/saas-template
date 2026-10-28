import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { site } from "@/site";

export function Brand() {
  const { t: tr } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={tr("{0}首页", [tr(site.name)])}>
      <span className="brand-symbol">
        <Compass size={18} strokeWidth={2.2} />
      </span>
      {tr(site.name)}
    </Link>
  );
}
