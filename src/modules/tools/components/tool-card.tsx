import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Zap } from "lucide-react";
import type { Tool } from "../catalog";
import { ToolIcon } from "./tool-icon";

export function ToolCard({
  tool,
  showDetails = true,
}: {
  tool: Tool;
  showDetails?: boolean;
}) {
  const { t: tr } = useI18n();
  return (
    <Link
      to="/tools/$toolId"
      params={{
        toolId: tool.id,
      }}
      className="tool-card group"
    >
      <div className="tool-card-glow" aria-hidden="true" />
      <div className="tool-card-top">
        <ToolIcon tool={tool} />
        {showDetails && (
          <div className="tool-badge-cluster">
            <span className="tool-category-badge">{tr(tool.category)}</span>
          </div>
        )}
      </div>

      <div className="tool-card-body">
        <div className="tool-name-row">
          <h2>{tr(tool.name)}</h2>
          <ArrowUpRight size={17} className="tool-arrow-icon" aria-hidden="true" />
        </div>
        <p>{tr(tool.description)}</p>
      </div>

      {showDetails && (
        <div className="tool-card-bottom">
          <span className="tool-cost-tag">
            <Zap size={12} />
            {tr("1 积分 / 次")}
          </span>
          <span className="tool-action-label">{tr("立即体验")}</span>
        </div>
      )}
    </Link>
  );
}
