import { useI18n } from "@/i18n/react";
export function TableEmptyRow({
  columns,
  message = "暂无符合条件的记录",
}: {
  columns: number;
  message?: string;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <tr>
      <td colSpan={columns} className="table-empty">
        {tr(message)}
      </td>
    </tr>
  );
}
