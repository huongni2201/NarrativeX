import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--violet)] text-[#140c27] hover:bg-[var(--violet-bright)]",
        outline: "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--violet)] hover:text-[var(--text)]",
        ghost: "bg-transparent text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
        destructive: "border border-[rgba(233,119,119,.25)] bg-[rgba(233,119,119,.12)] text-[var(--danger)] hover:bg-[rgba(233,119,119,.2)]",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 rounded-[4px] px-2 text-[10px]",
        lg: "h-10 px-4",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
