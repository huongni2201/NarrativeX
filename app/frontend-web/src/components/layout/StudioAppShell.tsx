"use client";

import dynamic from "next/dynamic";
import { StudioHeader } from "@/components/layout/StudioHeader";
import { StudioMobileNav } from "@/components/layout/StudioMobileNav";
import { StudioSidebar } from "@/components/layout/StudioSidebar";
import { AuthLoadingScreen, AuthScreen } from "@/features/auth/AuthScreen";
import { useAuthStore } from "@/store/useAuthStore";
import { useStudioStore } from "@/store/useStudioStore";
import type { ScreenType } from "@/types/studio";
import type { ProductionTab } from "@/features/production/production.types";

const ProjectsDashboard = dynamic(() =>
  import("@/features/dashboard/ProjectsDashboard").then((module) => module.ProjectsDashboard),
);
const ProductionShell = dynamic(() =>
  import("@/features/production/ProductionShell").then((module) => module.ProductionShell),
);
const ProductionTimelineScreen = dynamic(() =>
  import("@/features/production/ProductionTimelineScreen").then(
    (module) => module.ProductionTimelineScreen,
  ),
);
const ChapterEditor = dynamic(() =>
  import("@/features/chapters/components/ChapterEditor").then((module) => module.ChapterEditor),
);
const ProjectStoryboardScreen = dynamic(() =>
  import("@/features/storyboard/ProjectStoryboardScreen").then(
    (module) => module.ProjectStoryboardScreen,
  ),
);
const CharacterLibrary = dynamic(() =>
  import("@/features/characters/CharacterLibrary").then((module) => module.CharacterLibrary),
);
const CharacterDetailView = dynamic(() =>
  import("@/features/characters/CharacterDetailView").then((module) => module.CharacterDetailView),
);
const ProjectWizardModal = dynamic(() =>
  import("@/features/project-creation/ProjectWizardModal").then((module) => module.ProjectWizardModal),
);
const AssetLibraryScreen = dynamic(() =>
  import("@/features/assets/AssetLibraryScreen").then((module) => module.AssetLibraryScreen),
);
const StylePresetsScreen = dynamic(() =>
  import("@/features/presets/StylePresetsScreen").then((module) => module.StylePresetsScreen),
);
const JobHistoryScreen = dynamic(() =>
  import("@/features/history/JobHistoryScreen").then((module) => module.JobHistoryScreen),
);
const NotificationScreen = dynamic(() =>
  import("@/features/notifications/NotificationScreen").then((module) => module.NotificationScreen),
);

type StudioRouteScreen = Extract<
  ScreenType,
  | "overview"
  | "dashboard"
  | "project-workspace"
  | "chapter-workspace"
  | "production-timeline"
  | "storyboard"
  | "characters"
  | "character-detail"
  | "assets"
  | "presets"
  | "history"
  | "notifications"
>;

interface StudioAppShellProps {
  screen: StudioRouteScreen;
  projectId?: string;
  chapterId?: string;
  characterId?: string;
  initialTab?: ProductionTab;
}

const screenTitles: Record<StudioRouteScreen, string> = {
  overview: "Dự án của tôi",
  dashboard: "Quản lý dự án",
  "project-workspace": "Quản lý dự án",
  "chapter-workspace": "Biên tập chương",
  "production-timeline": "Production",
  storyboard: "Bảng phân cảnh",
  characters: "Thư viện nhân vật",
  "character-detail": "Chi tiết nhân vật",
  assets: "Thư viện tài sản",
  presets: "Mẫu & phong cách",
  history: "Lịch sử công việc",
  notifications: "Trung tâm thông báo",
};

export function StudioAppShell({
  screen,
  projectId,
  chapterId,
  characterId,
  initialTab,
}: Readonly<StudioAppShellProps>) {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const isWizardOpen = useStudioStore((state) => state.isWizardOpen);

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
            className="text-sm text-primary-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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
    <div className="flex min-h-screen bg-background text-text-primary">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-surface-card px-4 py-2 text-sm font-semibold text-text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Bỏ qua đến nội dung chính
      </a>
      <div className="hidden lg:block">
        <StudioSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <StudioHeader title={screenTitles[screen]} />

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1700px] flex-1 p-4 pb-24 outline-none sm:p-5 sm:pb-24 lg:p-8 lg:pb-16">
          {screen === "overview" && <ProjectsDashboard />}
          {(screen === "project-workspace" || screen === "dashboard") && (
            <ProductionShell projectId={projectId} initialTab={initialTab} />
          )}
          {screen === "chapter-workspace" && projectId && chapterId && (
            <ChapterEditor projectId={projectId} chapterId={chapterId} />
          )}
          {screen === "production-timeline" && projectId && (
            <ProductionTimelineScreen projectId={projectId} />
          )}
          {screen === "storyboard" && projectId && (
            <ProjectStoryboardScreen projectId={projectId} />
          )}
          {screen === "characters" && <CharacterLibrary />}
          {screen === "character-detail" && characterId && (
            <CharacterDetailView
              characterId={characterId}
              projectId={projectId}
            />
          )}
          {screen === "assets" && <AssetLibraryScreen />}
          {screen === "presets" && <StylePresetsScreen />}
          {screen === "history" && <JobHistoryScreen />}
          {screen === "notifications" && <NotificationScreen />}
        </main>
      </div>

      <StudioMobileNav />
      {isWizardOpen && <ProjectWizardModal />}
    </div>
  );
}
