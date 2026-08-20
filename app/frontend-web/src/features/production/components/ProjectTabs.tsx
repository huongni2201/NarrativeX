import type { ProductionTab } from "../production.types";

interface ProjectTabConfig {
  id: ProductionTab;
  label: string;
}

const projectTabConfig: readonly ProjectTabConfig[] = [
  { id: "chapters", label: "Chapters" },
  { id: "storyboard", label: "Storyboard" },
  { id: "info", label: "Thông tin dự án" },
  { id: "characters", label: "Nhân vật" },
  { id: "locations", label: "Địa điểm" },
  { id: "assets", label: "Tài sản" },
  { id: "settings", label: "Cài đặt" },
];

interface ProjectTabsProps {
  activeTab: ProductionTab;
  onChange: (tab: ProductionTab) => void;
}

export function ProjectTabs({ activeTab, onChange }: Readonly<ProjectTabsProps>) {
  return (
    <div className="mt-2 border-t border-slate-800 px-6 pt-4">
      <nav className="flex min-w-max gap-8 overflow-x-auto text-base" aria-label="Project tabs">
        {projectTabConfig.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
          />
        ))}
      </nav>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: Readonly<{ label: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 py-4 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${active
        ? "border-purple-500 text-purple-200"
        : "border-transparent font-semibold text-slate-400 hover:text-slate-200"
        }`}
    >
      {label}
    </button>
  );
}

