import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", icon, rightElement, error, disabled, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            disabled={disabled}
            className={cn(
              "w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500",
              "focus-visible:outline-none focus-visible:border-purple-500 focus-visible:ring-1 focus-visible:ring-purple-500/50 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900",
              icon && "pl-10",
              rightElement && "pr-10",
              error && "border-rose-500/80 focus-visible:border-rose-500 focus-visible:ring-rose-500/30",
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, disabled, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <textarea
          ref={ref}
          disabled={disabled}
          className={cn(
            "w-full bg-[#0a0f1d] border border-slate-800 rounded-lg p-3 text-sm text-slate-100 placeholder:text-slate-500",
            "focus-visible:outline-none focus-visible:border-purple-500 focus-visible:ring-1 focus-visible:ring-purple-500/50 transition-colors resize-none",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900",
            error && "border-rose-500/80 focus-visible:border-rose-500 focus-visible:ring-rose-500/30",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
