"use client";

import React from "react";
import {
  BookOpen,
  Film,
  Image as ImageIcon,
  MapPin,
  Settings,
  Users,
} from "lucide-react";
import type { ProductionTab } from "../production.types";

interface ProjectTabConfig {
  id: ProductionTab;
  label: string;
  icon: React.ReactNode;
}

const projectTabConfig: readonly ProjectTabConfig[] = [
  { id: "chapters", label: "Chapters", icon: <BookOpen className="h-4 w-4" /> },
  { id: "storyboard", label: "Storyboard", icon: <Film className="h-4 w-4" /> },
  { id: "characters", label: "Nhân vật", icon: <Users className="h-4 w-4" /> },
  { id: "locations", label: "Địa điểm", icon: <MapPin className="h-4 w-4" /> },
  { id: "assets", label: "Tài sản", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "settings", label: "Cài đặt", icon: <Settings className="h-4 w-4" /> },
];

interface ProjectTabsProps {
  activeTab: ProductionTab;
  onChange: (tab: ProductionTab) => void;
}

export function ProjectTabs({ activeTab, onChange }: Readonly<ProjectTabsProps>) {
  return (
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border-dark pb-3" role="tablist" aria-label="Các khu vực của dự án">
      {projectTabConfig.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              isActive
                ? "border border-primary/70 bg-primary-muted text-primary-hover shadow-sm"
                : "border border-border-dark bg-surface/60 text-slate-400 hover:border-border hover:text-slate-200"
            }`}
          >
            <span className={isActive ? "text-primary-hover" : "text-slate-500"}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
