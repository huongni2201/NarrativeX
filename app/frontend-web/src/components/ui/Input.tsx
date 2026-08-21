import React, { useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", icon, rightElement, error, disabled, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "w-full bg-surface-input border border-border rounded-lg px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted",
              "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900",
              icon && "pl-10",
              rightElement && "pr-10",
              error && "border-rose-500/80 focus-visible:border-rose-500 focus-visible:ring-rose-500/30",
              className,
            )}
            {...props}
          />
          {rightElement && <div className="absolute right-3 flex items-center justify-center">{rightElement}</div>}
        </div>
        {error && <p id={errorId} role="alert" className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, disabled, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const errorId = error ? `${textareaId}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="w-full space-y-1">
        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full bg-surface-input border border-border rounded-lg p-3 text-sm text-text-primary placeholder:text-text-muted",
            "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-colors resize-none",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900",
            error && "border-rose-500/80 focus-visible:border-rose-500 focus-visible:ring-rose-500/30",
            className,
          )}
          {...props}
        />
        {error && <p id={errorId} role="alert" className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
