import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "pills" | "underlined" | "subtle";
  ariaLabel?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  variant = "pills",
  ariaLabel = "Danh mục",
}) => {
  if (variant === "underlined") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn("flex items-center gap-6 border-b border-slate-800", className)}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                "pb-3 text-sm font-medium transition-all relative flex items-center gap-2 focus-visible:outline-none focus-visible:text-purple-300",
                isActive
                  ? "text-purple-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_8px_rgba(124,58,237,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1.5 p-1 bg-[#090e18] border border-slate-800/80 rounded-lg",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
              isActive
                ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)] font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                  isActive
                    ? "bg-purple-700 text-white"
                    : "bg-slate-800 text-slate-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
