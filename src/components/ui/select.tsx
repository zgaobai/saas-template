import { useI18n } from "@/i18n/react";
import { Children, isValidElement, type ReactNode } from "react";
import { Select as Primitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

/** Theme-aware single choice control; option labels remain next to their caller. */
export function Select({
  value,
  onValueChange,
  children,
  id,
  className = "",
  disabled,
  required,
  "aria-label": label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
}) {
  const { t: tr, locale } = useI18n();
  const items = Children.toArray(children).flatMap((child) =>
    isValidElement<{
      value: string;
      children: ReactNode;
      disabled?: boolean;
    }>(child)
      ? [
          {
            value: child.props.value,
            label: tr(child.props.children),
            disabled: child.props.disabled,
          },
        ]
      : [],
  );
  return (
    <Primitive.Root
      value={value}
      onValueChange={(v) => {
        if (v !== null) onValueChange(v);
      }}
      items={items}
      disabled={disabled}
      required={required}
    >
      <Primitive.Trigger
        id={id}
        aria-label={tr(label)}
        className={`select-trigger ${className}`}
      >
        <Primitive.Value />
        <Primitive.Icon>
          <ChevronDown size={15} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Positioner
          sideOffset={6}
          alignItemWithTrigger={false}
          className="select-positioner"
        >
          <Primitive.Popup className="select-popup">
            <Primitive.List className="select-list">
              {items.map((item) => (
                <Primitive.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className="select-option"
                >
                  <Primitive.ItemText>{tr(item.label)}</Primitive.ItemText>
                  <Primitive.ItemIndicator>
                    <Check size={15} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.List>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
