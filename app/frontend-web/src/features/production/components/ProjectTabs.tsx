"use client";

import React from "react";
import {
  BookOpen,
  Clapperboard,
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
  onOpenProduction: () => void;
}

export function ProjectTabs({
  activeTab,
  onChange,
  onOpenProduction,
}: Readonly<ProjectTabsProps>) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto border-b border-border-dark pb-3"
      role="tablist"
      aria-label="Các khu vực của dự án"
    >
      {projectTabConfig.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? "border border-primary/70 bg-primary-muted text-primary-light shadow-sm"
                : "border border-border-dark bg-surface/60 text-text-secondary hover:border-border hover:text-text-primary"
            }`}
          >
            <span className={isActive ? "text-primary-light" : "text-text-muted"}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenProduction}
        className="ml-auto flex items-center gap-2 whitespace-nowrap rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-200 transition-colors hover:border-orange-400 hover:bg-orange-500/15 hover:text-white"
        aria-label="Mở Production Timeline của project"
      >
        <Clapperboard className="h-4 w-4" />
        <span>Production</span>
      </button>
    </div>
  );
}
