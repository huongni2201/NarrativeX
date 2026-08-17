import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "gradient";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 select-none " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b14] " +
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

    const variantStyles = {
      primary:
        "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] border border-purple-400/30",
      gradient:
        "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_25px_rgba(124,58,237,0.4)] border border-purple-400/30",
      secondary:
        "bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 border border-slate-700/80 hover:border-slate-600 shadow-sm",
      outline:
        "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-700/80 hover:border-purple-500/50",
      ghost:
        "bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent",
      danger:
        "bg-rose-600/90 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)] border border-rose-500/30",
    };

    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs gap-1.5",
      md: "px-4 py-2 text-sm gap-2",
      lg: "px-6 py-2.5 text-base gap-2.5 font-semibold",
      icon: "p-2 aspect-square rounded-lg",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading ? (
          <span
            className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
            aria-hidden="true"
          />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
