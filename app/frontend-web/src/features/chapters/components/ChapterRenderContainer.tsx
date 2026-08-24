"use client";

import { useState } from "react";
import { useChapterRender } from "@/features/render/hooks/useChapterRender";
import type {
  ApiChapterWorkspaceProgressStep,
  ApiChapterWorkspaceRenderStep,
  ChapterId,
  ProjectId,
} from "@/types/api";
import { ChapterRenderTab } from "./ChapterRenderTab";

interface ChapterRenderContainerProps {
  projectId: ProjectId;
  chapterId: ChapterId;
  initialMedia: ApiChapterWorkspaceProgressStep;
  initialRender: ApiChapterWorkspaceRenderStep;
}

export function ChapterRenderContainer({
  projectId,
  chapterId,
  initialMedia,
  initialRender,
}: Readonly<ChapterRenderContainerProps>) {
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const render = useChapterRender({
    projectId,
    chapterId,
    resolution,
    format: "mp4",
    maxAuthorizedCost: "0.500000",
    initialMedia,
    initialJobId: initialRender.latestJobId,
    initialRenderStatus: initialRender.status,
    initialArtifactId: initialRender.artifactId,
  });

  return (
    <ChapterRenderTab
      render={render}
      resolution={resolution}
      onResolutionChange={setResolution}
    />
  );
}
