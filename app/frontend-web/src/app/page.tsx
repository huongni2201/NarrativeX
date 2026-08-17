"use client";

import React from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import { StudioSidebar } from "@/components/layout/StudioSidebar";
import { StudioHeader } from "@/components/layout/StudioHeader";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { ProjectsDashboard } from "@/features/dashboard/ProjectsDashboard";
import { CharacterLibrary } from "@/features/characters/CharacterLibrary";
import { ProjectWizardModal } from "@/features/project-creation/ProjectWizardModal";
import { CharacterBibleModal } from "@/features/characters/CharacterBibleModal";
import { ProductionShell } from "@/features/production/ProductionShell";
import { Layers, Film } from "lucide-react";

export default function HomePage() {
  const { currentScreen, setScreen, openWizard, wizardDraft } = useStudioStore();
  const { currentView, setView, openAddChapterModal } = useProductionStore();

  if (currentScreen === "auth") {
    return <AuthScreen />;
  }

  const screenTitles: Record<string, string> = {
    dashboard: "Production Workspace – Huyền Thoại Kiếm Thần",
    characters: "Thư viện nhân vật",
    "character-bible": "Chi tiết nhân vật (Character Bible)",
    wizard: `Tạo dự án mới – Bước ${wizardDraft.step}`,
  };

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100">
      {/* Studio Left Sidebar */}
      <StudioSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Studio Top Header */}
        <StudioHeader title={screenTitles[currentScreen] || "Production Workspace"} />

        {/* Dynamic Screen View Content */}
        <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto pb-28">
          {currentScreen === "dashboard" && <ProductionShell />}
          {currentScreen === "characters" && <CharacterLibrary />}
        </main>
      </div>

      {/* Project Creation Wizard Modal (Steps 1 to 4) */}
      <ProjectWizardModal />

      {/* Character Bible Detail Modal (Screen 08) */}
      <CharacterBibleModal />

      {/* Bottom Floating Screen Switcher for Easy Presentation & Review */}
      <aside aria-label="Demo Navigation" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#0d1420]/95 backdrop-blur-xl border border-purple-500/40 rounded-full px-4 py-2 shadow-[0_0_30px_rgba(124,58,237,0.35)] flex items-center gap-2 overflow-x-auto max-w-[96vw]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 pr-2 border-r border-slate-700/80 shrink-0">
          <Film className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Workspace:</span>
        </div>

        <div className="flex items-center gap-1">
          {[
            {
              id: "p01",
              name: "01. Project Overview",
              action: () => {
                setScreen("dashboard");
                setView("overview");
              },
            },
            {
              id: "p02",
              name: "02. + Add Chapter",
              action: () => {
                setScreen("dashboard");
                openAddChapterModal();
              },
            },
            {
              id: "p03",
              name: "03. Chapter Workspace",
              action: () => {
                setScreen("dashboard");
                setView("workspace");
              },
            },
            {
              id: "p04",
              name: "04. Storyboard",
              action: () => {
                setScreen("dashboard");
                setView("storyboard");
              },
            },
            {
              id: "p05",
              name: "05. Visual Review",
              action: () => {
                setScreen("dashboard");
                setView("visual-review");
              },
            },
            {
              id: "p06",
              name: "06. Render",
              action: () => {
                setScreen("dashboard");
                setView("render");
              },
            },
            {
              id: "p07",
              name: "07. Long-form Preview",
              action: () => {
                setScreen("dashboard");
                setView("preview");
              },
            },
            {
              id: "p08",
              name: "Character Bible",
              action: () => setScreen("character-bible"),
            },
          ].map((screen) => {
            const isCurrent =
              (screen.id === "p01" && currentScreen === "dashboard" && currentView === "overview") ||
              (screen.id === "p03" && currentScreen === "dashboard" && currentView === "workspace") ||
              (screen.id === "p04" && currentScreen === "dashboard" && currentView === "storyboard") ||
              (screen.id === "p05" && currentScreen === "dashboard" && currentView === "visual-review") ||
              (screen.id === "p06" && currentScreen === "dashboard" && currentView === "render") ||
              (screen.id === "p07" && currentScreen === "dashboard" && currentView === "preview") ||
              (screen.id === "p08" && currentScreen === "character-bible");

            return (
              <button
                key={screen.id}
                onClick={screen.action}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  isCurrent
                    ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.6)] font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {screen.name}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
