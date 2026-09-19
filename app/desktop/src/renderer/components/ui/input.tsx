import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-9.5 w-full rounded-md border border-input bg-surface-input px-3.5 text-[13px] text-foreground outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-border-dark focus-visible:border-primary focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-dim disabled:opacity-60",
        // Density reference: h-8 text-[12px]
        className,
      )}
      {...props}
    />
  );
}

export { Input };
