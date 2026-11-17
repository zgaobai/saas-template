import * as React from "react";
import { Tooltip as Primitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Provider>) {
  return <Primitive.Provider {...props}>{children}</Primitive.Provider>;
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
}) {
  if (!content) return <>{children}</>;

  return (
    <Primitive.Root>
      <Primitive.Trigger render={children as any} />
      <Primitive.Portal>
        <Primitive.Positioner side={side} align={align} sideOffset={sideOffset}>
          <Primitive.Popup className={cn("ui-tooltip-popup", className)}>
            <Primitive.Arrow className="ui-tooltip-arrow" />
            {content}
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
