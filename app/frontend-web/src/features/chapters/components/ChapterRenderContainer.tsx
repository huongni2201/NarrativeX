"use client";

import { useState } from "react";
import { useChapterRender } from "@/features/render/hooks/useChapterRender";
import { ChapterRenderTab } from "./ChapterRenderTab";

interface ChapterRenderContainerProps {
  projectId: number;
  chapterId: number;
  initialRender: {
    status: string;
    latestJobId: string | null;
    artifactId: number | null;
  };
}

export function ChapterRenderContainer({ projectId, chapterId, initialRender }: Readonly<ChapterRenderContainerProps>) {
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const render = useChapterRender({
    projectId,
    chapterId,
    resolution,
    format: "mp4",
    maxAuthorizedCost: "0.500000",
    initialJobId: initialRender.latestJobId,
    initialRenderStatus: initialRender.status,
    initialArtifactId: initialRender.artifactId,
  });

  return <ChapterRenderTab render={render} resolution={resolution} onResolutionChange={setResolution} />;
}
