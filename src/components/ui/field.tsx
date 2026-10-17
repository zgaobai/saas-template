import { useI18n } from "@/i18n/react";
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
export function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: ReactNode;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <div className="field">
      <label htmlFor={id}>{tr(label)}</label>
      {children}
      {hint && <p className="field-hint">{tr(hint)}</p>}
    </div>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { t: tr } = useI18n();
  return (
    <input
      {...props}
      placeholder={tr(props.placeholder)}
      aria-label={tr(props["aria-label"])}
      className={`input ${props.className || ""}`}
    />
  );
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { t: tr } = useI18n();
  return (
    <textarea
      {...props}
      placeholder={tr(props.placeholder)}
      aria-label={tr(props["aria-label"])}
      className={`input textarea ${props.className || ""}`}
    />
  );
}
