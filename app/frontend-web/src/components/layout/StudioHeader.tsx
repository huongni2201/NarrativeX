import React from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface StudioHeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({ title, actions }) => {
  const { currentScreen, setScreen, openWizard, logout, wizardDraft } = useStudioStore();

  const screens = [
    { id: "auth", label: "01. Đăng nhập / Đăng ký", action: () => setScreen("auth") },
    { id: "dashboard", label: "02. Dashboard – Dự án", action: () => setScreen("dashboard") },
    { id: "wizard-1", label: "03. Tạo dự án mới", action: () => openWizard(1) },
    { id: "wizard-2", label: "04. Nhập truyện", action: () => openWizard(2) },
    { id: "wizard-3", label: "05. Phân tích AI", action: () => openWizard(3) },
    { id: "wizard-4", label: "06. Kết quả phân tích", action: () => openWizard(4) },
    { id: "characters", label: "07. Thư viện nhân vật", action: () => setScreen("characters") },
    { id: "character-bible", label: "08. Character Bible", action: () => setScreen("character-bible") },
  ];

  return (
    <header className="h-16 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Title & Screen Navigation Pill */}
      <div className="flex items-center gap-4">
        {title && <h1 className="text-xl font-bold text-slate-100">{title}</h1>}
      </div>

      {/* Right Controls & Quick Screen Switcher */}
      <div className="flex items-center gap-3">
        {/* Quick Mockup Screen Jump Selector */}
        <div className="hidden lg:flex items-center bg-[#0d1420] border border-slate-800/90 rounded-lg p-1 text-xs">
          <span className="px-2 text-slate-500 font-mono text-[11px] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" /> Screen Demo:
          </span>
          <select
            value={
              currentScreen === "wizard"
                ? `wizard-${wizardDraft.step}`
                : currentScreen
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith("wizard-")) {
                const step = parseInt(val.split("-")[1], 10) as 1 | 2 | 3 | 4;
                openWizard(step);
              } else {
                setScreen(val as any);
              }
            }}
            className="bg-transparent text-purple-300 font-medium focus:outline-none cursor-pointer pr-2"
          >
            {screens.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#0d1420] text-slate-200">
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {actions}

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/40 ring-2 ring-purple-600/20">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop"
              alt="Ngọc Bùi"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-xs font-semibold text-slate-200 hidden sm:inline-block">
            Ngọc Bùi
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
};
