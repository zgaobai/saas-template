import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/site";
export function Brand() {
  const { t: tr, locale } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={tr("{0}首页", [tr(site.name)])}>
      <span className="brand-symbol">
        <ArrowUpRight size={23} strokeWidth={2.4} />
      </span>
      {tr(site.name)}
      <span className="brand-note">AI</span>
    </Link>
  );
}
