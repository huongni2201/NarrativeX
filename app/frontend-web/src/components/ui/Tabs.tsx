import React, { useRef } from "react";
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

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className, variant = "pills", ariaLabel = "Danh mục" }) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      onChange(nextTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        variant === "underlined"
          ? "flex items-center gap-6 border-b border-slate-800"
          : "flex items-center gap-1.5 p-1 bg-[#090e18] border border-slate-800/80 rounded-lg",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex items-center gap-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
              variant === "underlined" ? "pb-3 text-sm" : "px-3 py-1.5 text-xs rounded-md",
              isActive
                ? variant === "underlined" ? "text-purple-400 font-semibold" : "bg-purple-600 text-white font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-mono", isActive ? "bg-purple-700 text-white" : "bg-slate-800 text-slate-400")}>{tab.count}</span>
            )}
            {variant === "underlined" && isActive && <span aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
          </button>
        );
      })}
    </div>
  );
};
