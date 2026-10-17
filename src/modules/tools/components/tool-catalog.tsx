import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { tools, categories } from "../catalog";
import { ToolCard } from "./tool-card";
export function ToolCatalog({ standalone = false }: { standalone?: boolean }) {
  const { t: tr, locale } = useI18n();
  const Heading = standalone ? "h1" : "h2";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("全部工具");
  const visible = tools.filter(
    (t) =>
      (category === "全部工具" || t.category === category) &&
      `${tr(t.name)}${tr(t.description)}${tr(t.category)}${tr(t.name)}${t.description}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <section className="tool-directory container" id="tools">
        <div className="marketing-heading">
          <Heading>
            {standalone ? tr("AI 工具") : tr("一个工具箱，装下日常创作。")}
          </Heading>
          <p>{tr("从第一句话到最后一次润色，找到适合此刻的工具。")}</p>
        </div>
        <div className="tool-search">
          <Search size={20} />
          <label className="sr-only" htmlFor="tool-search">
            {tr("搜索 AI 工具")}
          </label>
          <input
            id="tool-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("搜索工具，比如「翻译」「摘要」")}
          />
          {query && (
            <button aria-label={tr("清空搜索")} onClick={() => setQuery("")}>
              <X size={18} />
            </button>
          )}
          <span className="search-count">
            {tr("{0} 个工具", [tools.length])}
          </span>
        </div>
      </section>
      <section
        className="container tools-section"
        aria-label={tr("AI 工具列表")}
      >
        <div className="catalog-toolbar">
          <div className="category-tabs" aria-label={tr("工具分类")}>
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
                className={category === c ? "active" : ""}
              >
                {tr(c)}
              </button>
            ))}
          </div>
          <span aria-live="polite">{tr("{0} 个工具", [visible.length])}</span>
        </div>
        <div className="tool-grid">
          {visible.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
        {!visible.length && (
          <div className="empty">
            <h2>{tr("暂时没有匹配的工具")}</h2>
            <p>{tr("试试“文案”“摘要”或“翻译”，也可以查看全部工具。")}</p>
            <button
              className="button button-secondary"
              onClick={() => {
                setQuery("");
                setCategory("全部工具");
              }}
            >
              {tr("查看全部工具")}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
