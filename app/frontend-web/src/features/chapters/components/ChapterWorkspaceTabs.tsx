import type { WorkspaceTab } from "../hooks/useChapterWorkspaceState";
import { WORKSPACE_TABS } from "../hooks/useChapterWorkspaceState";

interface ChapterWorkspaceTabsProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

export function ChapterWorkspaceTabs({ activeTab, onTabChange }: Readonly<ChapterWorkspaceTabsProps>) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-slate-800/90 px-1"
      aria-label="Chapter workspace tabs"
    >
      {WORKSPACE_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={!tab.available}
          onClick={() => tab.available && onTabChange(tab.id)}
          className={`relative whitespace-nowrap px-3.5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 sm:px-4 ${
            activeTab === tab.id
              ? "text-purple-300 font-semibold"
              : tab.available
                ? "text-slate-300 hover:text-white"
                : "cursor-not-allowed text-slate-500"
          }`}
          title={tab.available ? undefined : "Tính năng này chưa có API runtime"}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-purple-500" />
          )}
        </button>
      ))}
    </nav>
  );
}
