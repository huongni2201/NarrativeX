import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus-visible:border-[var(--violet)] focus-visible:ring-2 focus-visible:ring-[var(--violet)]/30 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}
