import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("ui-badge", {
  variants: {
    variant: {
      default: "ui-badge-default",
      accent: "ui-badge-accent",
      cyan: "ui-badge-cyan",
      purple: "ui-badge-purple",
      rose: "ui-badge-rose",
      glass: "ui-badge-glass",
      outline: "ui-badge-outline",
      neon: "ui-badge-neon",
      success: "ui-badge-success",
      warning: "ui-badge-warning",
    },
    size: {
      sm: "ui-badge-sm",
      md: "ui-badge-md",
      lg: "ui-badge-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotPulse?: boolean;
  dotColor?: "green" | "amber" | "cyan" | "purple" | "rose";
}

export function Badge({
  className,
  variant,
  size,
  dot = false,
  dotPulse = true,
  dotColor = "green",
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "ui-badge-dot",
            `ui-badge-dot-${dotColor}`,
            dotPulse && "is-pulsing",
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
