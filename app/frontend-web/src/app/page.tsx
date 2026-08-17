"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useStudioStore } from "@/store/useStudioStore";
import { StudioSidebar } from "@/components/layout/StudioSidebar";
import { StudioHeader } from "@/components/layout/StudioHeader";
import { ProjectsDashboard } from "@/features/dashboard/ProjectsDashboard";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthLoadingScreen, AuthScreen } from "@/features/auth/AuthScreen";

const ProductionShell = dynamic(() => import("@/features/production/ProductionShell").then((module) => module.ProductionShell));
const CharacterLibrary = dynamic(() => import("@/features/characters/CharacterLibrary").then((module) => module.CharacterLibrary));
const ProjectWizardModal = dynamic(() => import("@/features/project-creation/ProjectWizardModal").then((module) => module.ProjectWizardModal));
const CharacterBibleModal = dynamic(() => import("@/features/characters/CharacterBibleModal").then((module) => module.CharacterBibleModal));
const AssetLibraryScreen = dynamic(() => import("@/features/assets/AssetLibraryScreen").then((module) => module.AssetLibraryScreen));
const StylePresetsScreen = dynamic(() => import("@/features/presets/StylePresetsScreen").then((module) => module.StylePresetsScreen));

export default function HomePage() {
  const currentScreen = useStudioStore((state) => state.currentScreen);
  const wizardStep = useStudioStore((state) => state.wizardDraft.step);
  const { status, error } = useAuthStore();

  if (status === "bootstrapping") {
    return <AuthLoadingScreen message="Đang kiểm tra phiên đăng nhập…" />;
  }

  if (status === "error") {
    return (
      <AuthLoadingScreen
        message={error || "Không thể kiểm tra phiên đăng nhập."}
        action={<button type="button" onClick={() => window.location.reload()} className="text-sm text-purple-300 hover:text-purple-200">Thử lại</button>}
      />
    );
  }

  if (status === "unauthenticated") {
    return <AuthScreen />;
  }

  const screenTitles: Record<string, string> = {
    overview: "Tổng quan – Danh sách dự án",
    dashboard: "Production Workspace – Huyền Thoại Kiếm Thần",
    "project-workspace": "Production Workspace – Huyền Thoại Kiếm Thần",
    characters: "Thư viện nhân vật",
    "character-bible": "Chi tiết nhân vật (Character Bible)",
    assets: "08. Thư viện tài sản (Asset Library)",
    presets: "09. Mẫu & Phong cách (Style & Presets)",
    wizard: `Tạo dự án mới – Bước ${wizardStep}`,
  };

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100">
      {/* Studio Left Sidebar */}
      <StudioSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Studio Top Header */}
        <StudioHeader title={screenTitles[currentScreen] || "Tổng quan"} />

        {/* Dynamic Screen View Content */}
        <main className="flex-1 p-5 lg:p-8 max-w-[1700px] w-full mx-auto pb-16">
          {/* Màn hình Tổng quan: Danh sách dự án */}
          {currentScreen === "overview" && <ProjectsDashboard />}

          {/* Màn hình Production Workspace: Dự án của tôi - Huyền Thoại Kiếm Thần */}
          {(currentScreen === "project-workspace" || currentScreen === "dashboard") && (
            <ProductionShell />
          )}

          {/* Màn hình Thư viện nhân vật */}
          {currentScreen === "characters" && <CharacterLibrary />}

          {/* Screen 08: Thư viện tài sản (Asset Library) */}
          {currentScreen === "assets" && <AssetLibraryScreen />}

          {/* Screen 09: Mẫu & Phong cách (Style & Presets) */}
          {currentScreen === "presets" && <StylePresetsScreen />}
        </main>
      </div>

      {/* Project Creation Wizard Modal (Steps 1 to 4) */}
      <ProjectWizardModal />

      {/* Character Bible Detail Modal */}
      <CharacterBibleModal />
    </div>
  );
}
