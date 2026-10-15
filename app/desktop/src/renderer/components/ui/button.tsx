import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-body font-medium transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.3)] hover:bg-primary-hover active:bg-primary-hover/90",
        outline:
          "border border-border bg-surface-input text-text-secondary shadow-xs hover:border-border-dark hover:bg-surface-2 hover:text-foreground active:bg-surface-3",
        ghost:
          "border border-transparent bg-transparent text-text-muted hover:bg-surface-2 hover:text-foreground active:bg-surface-3",
        destructive:
          "border border-danger-border bg-danger-bg text-danger hover:border-danger/40 hover:bg-destructive/20 active:bg-destructive/30",
      },
      size: {
        default: "h-9 px-4 text-body",
        sm: "h-8 px-3 text-label",
        lg: "h-10.5 px-5 text-[15px]",
        xl: "h-12 px-6 text-[16px]",
        icon: "size-9 p-0",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-10.5 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
