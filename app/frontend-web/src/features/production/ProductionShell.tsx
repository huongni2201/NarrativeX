import React from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { Screen01ProjectOverview } from "./Screen01ProjectOverview";
import { Screen02AddChapterModal } from "./Screen02AddChapterModal";
import { Screen03ChapterWorkspace } from "./Screen03ChapterWorkspace";
import { Screen04Storyboard } from "./Screen04Storyboard";
import { Screen05VisualReview } from "./Screen05VisualReview";
import { Screen06Render } from "./Screen06Render";
import { Screen07LongFormPreview } from "./Screen07LongFormPreview";

export const ProductionShell: React.FC = () => {
  const { currentView } = useProductionStore();

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
