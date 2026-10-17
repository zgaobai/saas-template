import { useI18n } from "@/i18n/react";
import type { ReactNode } from "react";
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <div className="page-heading">
      <div>
        <h1>{tr(title)}</h1>
        <p>{tr(description)}</p>
      </div>
      {action}
    </div>
  );
}
