import React, { useEffect } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { ChapterWorkspace } from "./ChapterWorkspace";

export const Storyboard: React.FC = () => {
  const { setActiveWorkspaceTab } = useProductionStore();

  useEffect(() => {
    setActiveWorkspaceTab("storyboard");
  }, [setActiveWorkspaceTab]);

  return <ChapterWorkspace />;
};
