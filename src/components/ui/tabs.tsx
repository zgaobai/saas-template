import * as React from "react";
import { Tabs as Primitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export function Tabs({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn("tabs-root", className)}
      {...props}
    />
  );
}

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn("tabs-list", className)}
      {...props}
    />
  );
}

export function Tab({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Tab>) {
  return (
    <Primitive.Tab
      className={cn("tab-trigger", className)}
      {...props}
    >
      {children}
    </Primitive.Tab>
  );
}

export function TabsIndicator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Indicator>) {
  return (
    <Primitive.Indicator
      className={cn("tabs-indicator", className)}
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Panel>) {
  return (
    <Primitive.Panel
      className={cn("tabs-panel", className)}
      {...props}
    />
  );
}

/**
 * High-level Segmented Control with animated sliding pill indicator
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  disabled = false,
}: {
  value: T;
  onChange: (val: T) => void;
  options: {
    value: T;
    label: React.ReactNode;
    icon?: React.ReactNode;
    badge?: string;
  }[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn("segmented-control", className, disabled && "is-disabled")}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={disabled}
            className={cn("segmented-tab", isSelected && "is-selected")}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && <span className="segmented-icon">{opt.icon}</span>}
            <span className="segmented-label">{opt.label}</span>
            {opt.badge && <span className="segmented-badge">{opt.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
