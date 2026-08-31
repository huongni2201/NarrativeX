import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full resize-y rounded-md border border-input bg-surface-input px-3 py-2 text-[12px] leading-5 text-foreground outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-border-dark focus-visible:border-primary focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-dim disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
