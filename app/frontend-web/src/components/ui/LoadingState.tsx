import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message: string;
  className?: string;
  iconClassName?: string;
}

export function LoadingState({ message, className, iconClassName }: Readonly<LoadingStateProps>) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex items-center justify-center gap-2 text-sm text-text-secondary", className)}
    >
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-primary/20 motion-safe:animate-pulse-glow"
        />
        <LoaderCircle
          aria-hidden="true"
          className={cn("relative h-5 w-5 animate-spin text-primary-light", iconClassName)}
        />
      </span>
      <span>{message}</span>
    </div>
  );
}
