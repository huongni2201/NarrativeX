import React from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { Screen01ProjectOverview } from "./Screen01ProjectOverview";
import { Screen02AddChapterModal } from "./Screen02AddChapterModal";
import { Screen03ChapterWorkspace } from "./Screen03ChapterWorkspace";
import { Screen04Storyboard } from "./Screen04Storyboard";
import { Screen05VisualReview } from "./Screen05VisualReview";
import { Screen06Render } from "./Screen06Render";
import { Screen07LongFormPreview } from "./Screen07LongFormPreview";
import { isMockDataMode } from "@/lib/data-mode";

export const ProductionShell: React.FC = () => {
  const { currentView } = useProductionStore();

  if (!isMockDataMode) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
        Production data is API-backed and will be connected in W2-D1+.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Current Screen View */}
      {currentView === "overview" && <Screen01ProjectOverview />}
      {currentView === "workspace" && <Screen03ChapterWorkspace />}
      {currentView === "storyboard" && <Screen04Storyboard />}
      {currentView === "visual-review" && <Screen05VisualReview />}
      {currentView === "render" && <Screen06Render />}
      {currentView === "preview" && <Screen07LongFormPreview />}

      {/* Screen 02 Add Chapter Modal */}
      <Screen02AddChapterModal />
    </div>
  );
};
