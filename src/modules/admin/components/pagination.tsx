import { useI18n } from "@/i18n/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function AdminPagination({
  page,
  count,
  hasNext,
  onPrevious,
  onNext,
}: {
  page: number;
  count: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <div className="admin-pagination">
      <span>{tr("第 {0} 页 · 本页 {1} 条", [page, count])}</span>
      <Button variant="secondary" disabled={page === 1} onClick={onPrevious}>
        <ChevronLeft size={14} />
        {tr("上一页")}
      </Button>
      <Button variant="secondary" disabled={!hasNext} onClick={onNext}>
        {tr("下一页")}
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}
