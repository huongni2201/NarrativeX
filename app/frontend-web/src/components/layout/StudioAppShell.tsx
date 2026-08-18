"use client";

import dynamic from "next/dynamic";
import { StudioHeader } from "@/components/layout/StudioHeader";
import { StudioMobileNav } from "@/components/layout/StudioMobileNav";
import { StudioSidebar } from "@/components/layout/StudioSidebar";
import { AuthLoadingScreen, AuthScreen } from "@/features/auth/AuthScreen";
import { useAuthStore } from "@/store/useAuthStore";
import { useStudioStore } from "@/store/useStudioStore";
import type { ScreenType } from "@/types/studio";

const ProjectsDashboard = dynamic(() =>
  import("@/features/dashboard/ProjectsDashboard").then((module) => module.ProjectsDashboard),
);
const ProductionShell = dynamic(() =>
  import("@/features/production/ProductionShell").then((module) => module.ProductionShell),
);
const ChapterEditor = dynamic(() =>
  import("@/features/chapters/components/ChapterEditor").then((module) => module.ChapterEditor),
);
const CharacterLibrary = dynamic(() =>
  import("@/features/characters/CharacterLibrary").then((module) => module.CharacterLibrary),
);
const ProjectWizardModal = dynamic(() =>
  import("@/features/project-creation/ProjectWizardModal").then((module) => module.ProjectWizardModal),
);
const CharacterBibleModal = dynamic(() =>
  import("@/features/characters/CharacterBibleModal").then((module) => module.CharacterBibleModal),
);
const AssetLibraryScreen = dynamic(() =>
  import("@/features/assets/AssetLibraryScreen").then((module) => module.AssetLibraryScreen),
);
const StylePresetsScreen = dynamic(() =>
  import("@/features/presets/StylePresetsScreen").then((module) => module.StylePresetsScreen),
);

type StudioRouteScreen = Extract<
  ScreenType,
  | "overview"
  | "dashboard"
  | "project-workspace"
  | "chapter-workspace"
  | "characters"
  | "assets"
  | "presets"
>;

interface StudioAppShellProps {
  screen: StudioRouteScreen;
  projectId?: string;
  chapterId?: string;
}

const screenTitles: Record<StudioRouteScreen, string> = {
  overview: "Dự án của tôi",
  dashboard: "Production Workspace",
  "project-workspace": "Production Workspace",
  "chapter-workspace": "Chapter Workspace",
  characters: "Thư viện nhân vật",
  assets: "Thư viện tài sản (Asset Library)",
  presets: "Mẫu & Phong cách (Style & Presets)",
};

export function StudioAppShell({
  screen,
  projectId,
  chapterId,
}: Readonly<StudioAppShellProps>) {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const isWizardOpen = useStudioStore((state) => state.isWizardOpen);
  const selectedCharacterId = useStudioStore((state) => state.selectedCharacterId);

  if (status === "bootstrapping") {
    return <AuthLoadingScreen message="Đang kiểm tra phiên đăng nhập…" />;
  }

  if (status === "error") {
    return (
      <AuthLoadingScreen
        message={error || "Không thể kiểm tra phiên đăng nhập."}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-purple-300 hover:text-purple-200"
          >
            Thử lại
          </button>
        }
      />
    );
  }

  if (status === "unauthenticated") {
    return <AuthScreen />;
  }

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100">
      <div className="hidden lg:block">
        <StudioSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <StudioHeader title={screenTitles[screen]} />

        <main className="mx-auto w-full max-w-[1700px] flex-1 p-4 pb-24 sm:p-5 sm:pb-24 lg:p-8 lg:pb-16">
          {screen === "overview" && <ProjectsDashboard />}
          {(screen === "project-workspace" || screen === "dashboard") && (
            <ProductionShell projectId={projectId} />
          )}
          {screen === "chapter-workspace" && projectId && chapterId && (
            <ChapterEditor projectId={projectId} chapterId={chapterId} />
          )}
          {screen === "characters" && <CharacterLibrary />}
          {screen === "assets" && <AssetLibraryScreen />}
          {screen === "presets" && <StylePresetsScreen />}
        </main>
      </div>

      <StudioMobileNav />
      {isWizardOpen && <ProjectWizardModal />}
      {selectedCharacterId && <CharacterBibleModal />}
    </div>
  );
}
