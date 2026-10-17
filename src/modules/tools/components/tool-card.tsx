import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { Tool } from "../catalog";
import { ToolIcon } from "./tool-icon";
export function ToolCard({
  tool,
  showDetails = true,
}: {
  tool: Tool;
  showDetails?: boolean;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <Link
      to="/tools/$toolId"
      params={{
        toolId: tool.id,
      }}
      className="tool-card"
    >
      <div className="tool-card-top">
        <ToolIcon tool={tool} />
        <ArrowUpRight size={18} className="tool-arrow" />
      </div>
      <h2>{tr(tool.name)}</h2>
      <p>{tr(tool.description)}</p>
      {showDetails && (
        <div className="tool-card-bottom">
          <span>{tr(tool.category)}</span>
          <span>{tr("1 积分 / 次")}</span>
        </div>
      )}
    </Link>
  );
}
