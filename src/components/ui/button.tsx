import { Button as Primitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const styles = cva("button", {
  variants: {
    variant: {
      primary: "button-primary",
      secondary: "button-secondary",
      ghost: "button-ghost",
      danger: "button-danger",
    },
    size: { default: "", small: "button-small" },
  },
  defaultVariants: { variant: "primary", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  ...props
}: Primitive.Props & VariantProps<typeof styles>) {
  return (
    <Primitive
      className={cn(styles({ variant, size }), className)}
      {...props}
    />
  );
}
