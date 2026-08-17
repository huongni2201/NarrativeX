"use client";

import { useProductionStore } from "@/store/useProductionStore";
import { AddChapterModal } from "./AddChapterModal";
import { ChapterWorkspace } from "./ChapterWorkspace";
import { LongFormPreview } from "./LongFormPreview";
import { ProjectOverview } from "./ProjectOverview";
import { Render } from "./Render";
import { VisualReview } from "./VisualReview";

export function ProductionDemoWorkspace() {
  const currentView = useProductionStore((state) => state.currentView);

  return (
    <div className="w-full">
      {currentView === "overview" && <ProjectOverview />}
      {(currentView === "workspace" || currentView === "storyboard") && <ChapterWorkspace />}
      {currentView === "visual-review" && <VisualReview />}
      {currentView === "render" && <Render />}
      {currentView === "preview" && <LongFormPreview />}
      <AddChapterModal />
    </div>
  );
}
