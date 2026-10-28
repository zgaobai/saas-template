import { useI18n } from "@/i18n/react";
import { Link } from "@tanstack/react-router";
import { PenLine, Clock, Wallet } from "lucide-react";
export function FeatureOverview({
  standalone = false,
}: {
  standalone?: boolean;
}) {
  const { t: tr } = useI18n();
  const Heading = standalone ? "h1" : "h2";
  return (
    <section className="marketing-features container" id="features">
      <div className="marketing-heading">
        <Heading>{tr("从灵感到成稿，每一步都简单。")}</Heading>
        <p>{tr("把时间留给想法，其余交给顺手的工具。")}</p>
      </div>
      <div className="feature-columns">
        <article>
          <PenLine size={24} />
          <h3>{tr("从你的内容开始")}</h3>
          <p>
            {tr(
              "粘贴原文或描述需求，选择合适的语气。没有复杂指令，也能清楚表达你的想法。",
            )}
          </p>
          <Link
            to="/tools/$toolId"
            params={{
              toolId: "copywriting",
            }}
          >
            {tr("试试文案生成")}
          </Link>
        </article>
        <article>
          <Clock size={24} />
          <h3>{tr("每次创作，都能找回来")}</h3>
          <p>
            {tr(
              "登录后生成结果自动保存。随时回顾、复制，继续完善，不必从头开始。",
            )}
          </p>
          <Link to="/history">
            {tr("查看创作记录")}
          </Link>
        </article>
        <article>
          <Wallet size={24} />
          <h3>{tr("积分清楚，使用有数")}</h3>
          <p>
            {tr(
              "每次成功生成消耗 1 积分，失败自动退回。余额和每一笔变动，都能在账单里查看。",
            )}
          </p>
          <Link to="/pricing">
            {tr("了解积分方案")}
          </Link>
        </article>
      </div>
    </section>
  );
}
